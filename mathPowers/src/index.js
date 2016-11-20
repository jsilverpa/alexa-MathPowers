 */


'use strict';


// Route the incoming request based on type (LaunchRequest, IntentRequest,
// etc.) The JSON body of the request is provided in the event parameter.
exports.handler = function (event, context) {
    try {
        console.log("event.session.application.applicationId=" + event.session.application.applicationId);

    
        if (event.session.new) {
            onSessionStarted({requestId: event.request.requestId}, event.session);
        }

        if (event.request.type === "LaunchRequest") {
            onLaunch(event.request,
                event.session,
                function callback(sessionAttributes, speechletResponse) {
                    context.succeed(buildResponse(sessionAttributes, speechletResponse));
                });
        } else if (event.request.type === "IntentRequest") {
            onIntent(event.request,
                event.session,
                function callback(sessionAttributes, speechletResponse) {
                    context.succeed(buildResponse(sessionAttributes, speechletResponse));
                });
        } else if (event.request.type === "SessionEndedRequest") {
            onSessionEnded(event.request, event.session);
            context.succeed();
        }
    } catch (e) {
        context.fail("Exception: " + e);
    }
};


/**
 * Called when the session starts.
 */
function onSessionStarted(sessionStartedRequest, session) {
    console.log("onSessionStarted requestId=" + sessionStartedRequest.requestId
        + ", sessionId=" + session.sessionId);

    // add any session init logic here
}

/**
 * Called when the user invokes the skill without specifying what they want.
 */
function onLaunch(launchRequest, session, callback) {
    console.log("onLaunch requestId=" + launchRequest.requestId
        + ", sessionId=" + session.sessionId);

    getWelcomeResponse(callback);
}

/**
 * Called when the user specifies an intent for this skill.
 */
function onIntent(intentRequest, session, callback) {
    console.log("onIntent requestId=" + intentRequest.requestId
        + ", sessionId=" + session.sessionId);

    var intent = intentRequest.intent,
        intentName = intentRequest.intent.name;

    // handle yes/no intent after the user has been prompted
    if (session.attributes && session.attributes.userPromptedToContinue) {
        delete session.attributes.userPromptedToContinue;
        if ("AMAZON.NoIntent" === intentName) {
            handleFinishSessionRequest(intent, session, callback);
        } else if ("AMAZON.YesIntent" === intentName) {
            handleRepeatRequest(intent, session, callback);
        }
    }

    // dispatch custom intents to handlers here
    if ("AnswerIntent" === intentName) {
        handleAnswerRequest(intent, session, callback);
    } else if ("AnswerOnlyIntent" === intentName) {
        handleAnswerRequest(intent, session, callback);
    } else if ("DontKnowIntent" === intentName) {
        handleAnswerRequest(intent, session, callback);
    } else if ("AMAZON.YesIntent" === intentName) {
        handleAnswerRequest(intent, session, callback);
    } else if ("AMAZON.NoIntent" === intentName) {
        handleAnswerRequest(intent, session, callback);
    } else if ("AMAZON.StartOverIntent" === intentName) {
        getWelcomeResponse(callback);
    } else if ("AMAZON.RepeatIntent" === intentName) {
        handleRepeatRequest(intent, session, callback);
    } else if ("AMAZON.HelpIntent" === intentName) {
        handleGetHelpRequest(intent, session, callback);
    } else if ("AMAZON.StopIntent" === intentName) {
        handleFinishSessionRequest(intent, session, callback);
    } else if ("AMAZON.CancelIntent" === intentName) {
        handleFinishSessionRequest(intent, session, callback);
    } else {
        throw "Invalid intent";
    }
}

//return the pluralized word (assume it just needs to add an 's' :-)
function pluralize(word, count) {
    if (count === 1) return word;
    return word + "s";
}

/**
 * Called when the user ends the session.
 * Is not called when the skill returns shouldEndSession=true.
 */
function onSessionEnded(sessionEndedRequest, session) {
    console.log("onSessionEnded requestId=" + sessionEndedRequest.requestId
        + ", sessionId=" + session.sessionId);

    // Add any cleanup logic here
}

// ------- Skill specific business logic -------



var GAME_START_DIGITS = 1;
var GAME_TOTAL_QUESTIONS = 5;
var PASS_RATE = 0.7;
var CARD_TITLE = "Education"; // Be sure to change this for your skill.
var SUCCESS_SOUND = "https://s3-us-west-2.amazonaws.com/jsilver-alexa-games/alexa_success_48kbps.mp3";
var FAIL_SOUND = "https://s3-us-west-2.amazonaws.com/jsilver-alexa-games/alexa_fail_48kbps.mp3";
function generateNextQuestion(questionNumber, dig) {
    var baseNumber = Math.floor(Math.random() * 9 * Math.pow(10,dig-1) + Math.pow(10,dig-1)),
        repromptText = "What is " + baseNumber + " squared?",
        spokenQuestion = "Question " + questionNumber + ". "+ repromptText + " ";
    return {
        baseNumber:baseNumber,
        spokenQuestion:spokenQuestion,
        repromptText:repromptText
    }; 
}

function getWelcomeResponse(callback) {
    console.log("Start of getWelcomeResonse.");
    var sessionAttributes = {},
    
        speechOutput = "Let's begin.  I will ask you a " + GAME_START_DIGITS.toString()
            + " digit number which you will have to square.  ";
    var quest = generateNextQuestion(1, GAME_START_DIGITS);        
  
    speechOutput += quest.spokenQuestion;
    var start = new Date();
    
    sessionAttributes = {
        "baseNumber": quest.baseNumber,
        "questionAskTime" : start.getTime(),
        "questionNumber" : 1,
        "dig" : 1,
        "score": 0,
        "scoreThisRound": 0,
        "speechOutput" : speechOutput, //used when user asks for help or repeat
        "repromptText" : quest.repromptText  //see above
    };
    callback(sessionAttributes,
        buildSpeechletResponse(CARD_TITLE, speechOutput, quest.repromptText, false));
}




function handleAnswerRequest(intent, session, callback) {
    var speechOutput = "";
    var sessionAttributes = {};
    var gameInProgress = session.attributes && session.attributes.questions;
    var userAnswer = 0;
    if (intent.slots && intent.slots.Answer && intent.slots.Answer.value && !isNaN(parseInt(intent.slots.Answer.value)))
        userAnswer = parseInt(intent.slots.Answer.value);
    var baseNumber = parseInt(session.attributes.baseNumber);
    var currentScore = parseInt(session.attributes.score);
    var scoreThisRound = parseInt(session.attributes.scoreThisRound);
    var questionNumber = parseInt(session.attributes.questionNumber);
    var dig = parseInt(session.attributes.dig);
    console.log("In AnswerRequest, baseNumber is "+baseNumber);
    if (userAnswer === (baseNumber * baseNumber)) {
        //correct answer
        speechOutput = "That is correct.";
        var endTime = new Date();
        var timeTaken = Math.max(Math.floor((endTime.getTime() - session.attributes.questionAskTime)/1000 - 10),1); /* hack.  it takes 10 seconds to read the question */
        var points = Math.max(Math.ceil(Math.pow(10, dig) - timeTaken),4*dig+3);
        speechOutput += " You took " + timeTaken + pluralize(" second",timeTaken) +".  You gained " + points + pluralize(" point", points) + "." ;
        currentScore += points;
        scoreThisRound += points;
    }
    else {
        speechOutput = "That is incorrect.  You answered " + userAnswer + ".  The correct answer to " + baseNumber + " squared is " + baseNumber * baseNumber + ".";
    }
    var lastQuestionThisRound = (questionNumber % GAME_TOTAL_QUESTIONS === 0);

    speechOutput += " Your total score after "+ questionNumber + pluralize(" question",questionNumber) + " is " + currentScore + ". ";
 
    var quest;   
    if (lastQuestionThisRound) {
        if (scoreThisRound >= GAME_TOTAL_QUESTIONS * PASS_RATE * Math.pow(10, dig)) {
            //level up
            speechOutput += "<audio src='" + SUCCESS_SOUND + "'/>" + "Congratulations.  You have passed "+ dig + " digit squaring.  Let's move on to squaring " + (dig+1) + " digit numbers. ";
            dig++;
        }
        else {
            speechOutput += "<audio src='" + FAIL_SOUND + "'/>" + "Sorry.   You need more practice squaring " + dig + " digit numbers.  Let's try that again. ";
        }
        scoreThisRound = 0;
        questionNumber = 0;
    }

    quest = generateNextQuestion(questionNumber+1,dig);
    var start = new Date();
    speechOutput += quest.spokenQuestion;
    sessionAttributes = {
        "baseNumber": quest.baseNumber,
        "questionAskTime" : start.getTime(),
        "questionNumber" : questionNumber+1,
        "dig" : dig,
        "score": currentScore,
        "scoreThisRound" : scoreThisRound,
        "speechOutput" : speechOutput,  //used when user asks for help or requests more time
        "repromptText" : quest.repromptText  //see above line
    };
    callback(sessionAttributes,
        buildSpeechletResponse(CARD_TITLE, speechOutput, quest.repromptText, false));
}


function handleRepeatRequest(intent, session, callback) {
    // Repeat the previous speechOutput and repromptText from the session attributes if available
    // else start a new game session
    if (!session.attributes || !session.attributes.speechOutput) {
        getWelcomeResponse(callback);
    } else {
        callback(session.attributes,
            buildSpeechletResponseWithoutCard(session.attributes.repromptText, session.attributes.repromptText, false));
    }
}

function handleGetHelpRequest(intent, session, callback) {
    // Provide a help prompt for the user, explaining how the game is played. Then, continue the game
    // if there is one in progress, or provide the option to start another one.
    
    // Ensure that session.attributes has been initialized
    if (!session.attributes) {
        session.attributes = {};
    }

    // Set a flag to track that we're in the Help state.
    session.attributes.userPromptedToContinue = true;

    // Do not edit the help dialogue. This has been created by the Alexa team to demonstrate best practices.

    var speechOutput = "You are being asked to square numbers.  You should respond with the answer.  For example, say, the answer is sixteen.  Or, you can just say, sixteen.  " 
           + " If you do well at one level, you will advance to the next level. "
           + " If you don't hear the question, or you need more time, say, repeat.   To start a new game at any time, say, start game. "
             + "Would you like to keep playing?",
        repromptText = "To give an answer to a question, say, the answer is sixteen.  Or, just say, sixteen. . "
        + "Would you like to keep playing?";
        var shouldEndSession = false;
  
  
    callback(session.attributes,
        buildSpeechletResponseWithoutCard(speechOutput, repromptText, shouldEndSession));
}

function handleFinishSessionRequest(intent, session, callback) {
    // End the session with a "Good bye!" if the user wants to quit the game
    callback(session.attributes,
        buildSpeechletResponseWithoutCard("Good bye!", "", true));
}


// ------- Helper functions to build responses -------


function buildSpeechletResponse(title, output, repromptText, shouldEndSession) {
    return {
        /* outputSpeech: {
            type: "PlainText",
            text: output
        }, */
         outputSpeech: {
            ssml: "<speak>" + output + "</speak>",
            type: "SSML"
        },
        card: {
            type: "Simple",
            title: title,
            content: repromptText
        },
        reprompt: {
            outputSpeech: {
                type: "PlainText",
                text: repromptText
            }
        },
        shouldEndSession: shouldEndSession
    };
}

function buildSpeechletResponseWithoutCard(output, repromptText, shouldEndSession) {
    return {
        outputSpeech: {
            type: "PlainText",
            text: output
        },
        reprompt: {
            outputSpeech: {
                type: "PlainText",
                text: repromptText
            }
        },
        shouldEndSession: shouldEndSession
    };
}



function buildResponse(sessionAttributes, speechletResponse) {
    return {
        version: "1.0",
        sessionAttributes: sessionAttributes,
        response: speechletResponse
    };
}
