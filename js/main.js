// Data from thebluealliance
var eventRankingsData;		// Event ranking data
var matchesData;			// Match data

// Variables
var M = m4th.matrix;		// Matrix object to spawn more matrices from
var dataNeeded = 0;			// Data needed to load
var dataLoaded = 0;			// Data that has been loaded

// Global Matrices [A]
var matchesMatrix;			 	// Matrix containing team participation	
var teamsParticipationMatrix;	// Matrix containing team participation in a match
var OPRMatrix;					// Constant Matrix that relates component OPR to component matrix

// Component Matrices [b]
var matchSumMatrix;

// GUI obj to contain reference to the HTML obj for updating gui wise
var $gui;

// Called when the document has been loaded once
$(document).ready(init);

// Called when the document has been loaded
function init()
{
	setEvent("orore");
}

// Set the event to get the opr data from
function setEvent(eventCode) 
{
	getData("event/2015" + eventCode + "/rankings", getEventRankings);
	getData("event/2015" + eventCode + "/matches", getMatchesData);
	update();
}

// The main body of opr scouting
function update()
{
	// Wait for all the data to be loaded first
	if(dataNeeded !== dataLoaded)
		setTimeout(update, 1000);
	
	else
	{
		// Event rankings data format
		// 0: "Rank"
		// 1: "Team"
		// 2: "Qual Avg"
		// 3: "Auto"
		// 4: "Container"
		// 5: "Coopertition"
		// 6: "Litter"
		// 7: "Tote"
		// 8: "Played"
		
		// Team numbers containing indexes
		var teamsIndex = [];
		
		// Find how many matches were played total at the competition
		var totalMatches = 0;
		
		for(var i = 0; i < matchesData.length; i++)
			if(matchesData[i].comp_level === "qm")
				totalMatches++;
		
		// Initialize variables
		var totalTeams = eventRankingsData.length - 1;
		var teamsMatrix = M(totalTeams, 1);
		
		// Global Matrices [A]
		matchesMatrix = getEmptyMatrix(totalTeams, totalMatches * 2);
		teamsParticipationMatrix = getEmptyMatrix(totalMatches * 2, totalTeams);
		
		// Component Matrices [b]
		var teamsAutoMatrix = M(totalTeams, 1);
		var teamsContainerMatrix = M(totalTeams, 1);
		var teamsCoopMatrix = M(totalTeams, 1);
		var teamsLitterMatrix = M(totalTeams, 1);
		var teamsToteMatrix = M(totalTeams, 1);
		matchSumMatrix = M(totalMatches * 2, 1);
		
		//OPR matrices
		var autoPR;
		var containerPR;
		var coopPR;
		var litterPR;
		var totePR;
		var overallPR;
		var foulPR;
		// Set the teamsMatrix and teamsContainerMatrix
		for(var i = 1; i < eventRankingsData.length; i++)
		{
			var teamNumber = eventRankingsData[i][1];					// Get team number
			teamsIndex[teamNumber] = i - 1;								// Give each team number an teams matrix index
			teamsMatrix.set(i - 1, 0, teamNumber);						// Set the teams matrix a number
			
			teamsAutoMatrix.set(i - 1, 0, eventRankingsData[i][3]);
			teamsContainerMatrix.set(i - 1, 0, eventRankingsData[i][4]);
			teamsCoopMatrix.set(i - 1, 0, eventRankingsData[i][5]);
			teamsLitterMatrix.set(i - 1, 0, eventRankingsData[i][6]);
			teamsToteMatrix.set(i - 1, 0, eventRankingsData[i][7]);
		}
			
		// Loop through all qualification matches
		for(var i = 0; i < matchesData.length; i++)
		{
			// Qualification matches only
			if(matchesData[i].comp_level === "qm")
			{
				// Get match number
				var matchNumber = matchesData[i].match_number;
				
				// Loop though red alliance, set corresponding matrix row column to 1
				for(var j = 0; j < matchesData[i].alliances.red.teams.length; j++)
				{
					var teamNumber =  parseInt(matchesData[i].alliances.red.teams[j].substr(3));
					
					// Global Matrix [A]
					matchesMatrix.set(teamsIndex[teamNumber], (matchNumber - 1) * 2, 1);
					teamsParticipationMatrix.set((matchNumber - 1) * 2, teamsIndex[teamNumber], 1);
				}
				
				// Loop though blue alliance, set corresponding matrix row column to 1
				for(var j = 0; j < matchesData[i].alliances.blue.teams.length; j++)
				{
					var teamNumber =  parseInt(matchesData[i].alliances.blue.teams[j].substr(3));
					
					// Global Matrix [A]
					matchesMatrix.set(teamsIndex[teamNumber], ((matchNumber - 1) * 2) + 1, 1);
					teamsParticipationMatrix.set(((matchNumber - 1) * 2) + 1, teamsIndex[teamNumber], 1);
				}
				
				// Add match sums to matrix, Component Matrix [b]
				matchSumMatrix.set((matchNumber - 1) * 2, 0, matchesData[i].alliances.red.score);
				matchSumMatrix.set(((matchNumber - 1) * 2) + 1, 0, matchesData[i].alliances.blue.score);
			}	
		}
		
		OPRMatrix = m4th.lu(matchesMatrix.mult(teamsParticipationMatrix)).getInverse();
		
		autoPR = getComponentOPR(teamsAutoMatrix);
		containerPR = getComponentOPR(teamsContainerMatrix);
		coopPR = getComponentOPR(teamsCoopMatrix);
		litterPR = getComponentOPR(teamsLitterMatrix);
		totePR = getComponentOPR(teamsToteMatrix);
		
		// Solves overdetermined system [A][x]=[b] using Cholesky decomposition 
		overallPR = m4th.ud(teamsParticipationMatrix.transp().mult(teamsParticipationMatrix)).solve(teamsParticipationMatrix.transp().mult(matchSumMatrix));		
		
		var toteCountPR = totePR.times(.5);
		var teamsTotalsMatrix = teamsAutoMatrix.add(teamsContainerMatrix).add(teamsCoopMatrix).add(teamsLitterMatrix).add(teamsToteMatrix);
		var foulAdjustedOPR = autoPR.add(containerPR).add(coopPR).add(litterPR).add(totePR);
		var overallContributionPercent = M(teamsTotalsMatrix.rows,1);
		
		foulPR = overallPR.minus(foulAdjustedOPR);
		
		var autoContributionPercent = M(teamsTotalsMatrix.rows,1);
		var containerContributionPercent = M(teamsTotalsMatrix.rows,1);
		var coopContributionPercent = M(teamsTotalsMatrix.rows,1);
		var litterContributionPercent = M(teamsTotalsMatrix.rows,1);
		var toteContributionPercent = M(teamsTotalsMatrix.rows,1);
		
		//TODO: match strength is the sum of all OPRs in your match history (except you). Carried is whether your contribution is < 33%
		for(var i = 0; i < teamsTotalsMatrix.rows; i++)
		{
			overallContributionPercent.set(i,0,overallPR.get(i,0)/teamsTotalsMatrix.get(i,0)*eventRankingsData[i+1][8]*100);
			
			autoContributionPercent.set(i,0,autoPR.get(i,0)/teamsAutoMatrix.get(i,0)*eventRankingsData[i+1][8]*100);
			containerContributionPercent.set(i,0,containerPR.get(i,0)/teamsContainerMatrix.get(i,0)*eventRankingsData[i+1][8]*100);
			coopContributionPercent.set(i,0,coopPR.get(i,0)/teamsCoopMatrix.get(i,0)*eventRankingsData[i+1][8]*100);
			litterContributionPercent.set(i,0,litterPR.get(i,0)/teamsLitterMatrix.get(i,0)*eventRankingsData[i+1][8]*100);
			toteContributionPercent.set(i,0,totePR.get(i,0)/teamsToteMatrix.get(i,0)*eventRankingsData[i+1][8]*100);
		}
		var cappedTotesPR = containerPR.times(.25);
		var uncappedTotesPR = toteCountPR.minus(cappedTotesPR);
	}
}

// Solves the system [A][B][x] = [b]
//[A] and [B] are binary matrices representing robot per match and match schedule per robot 
function getComponentOPR(componentMatrix)
{
	return OPRMatrix.mult(componentMatrix);
}

// Sets the eventRankingsData
function getEventRankings(data)
{
	eventRankingsData = data;
}

// Sets the matchesData
function getMatchesData(data)
{
	matchesData = data;
}

// Returns a matrix row by column filled with 0s
function getEmptyMatrix(row, column)
{
	var matrix = M(row, column);
	
	for(var i = 0; i < row; i++)
		for(var j = 0; j < column; j++)
			matrix.set(i, j, 0);
	
	return matrix;
}

// Gets data from thebluealliance
function getData(key, callback)
{
	dataNeeded++;
	
	$.ajax
	({
		url:"http://www.thebluealliance.com/api/v2/" + key + "?X-TBA-App-Id=frc955:opr-system:v01",
		success:function(data)
		{
			callback(data);
			dataLoaded++;
		},
		error:function()
		{
			callback(null);
		} 
	});
}