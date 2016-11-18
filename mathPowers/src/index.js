/**
 This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
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


var GAME_LENGTH = 1;
var GAME_DIGITS = 2;
var GAME_TOTAL_QUESTIONS = 5;
var CARD_TITLE = "Trivia"; // Be sure to change this for your skill.

function generateNextQuestion(questionNumber) {
    var baseNumber = Math.floor(Math.random() * 9 * Math.pow(10,GAME_DIGITS-1) + Math.pow(10,GAME_DIGITS-1)),
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
    
        speechOutput = "Let's begin.  I will ask you a " + GAME_DIGITS.toString()
            + " digit number which you will have to square.  ";
    var quest = generateNextQuestion(1);        
  
    speechOutput += quest.spokenQuestion;
    var start = new Date();
    
    sessionAttributes = {
        "baseNumber": quest.baseNumber,
        "questionAskTime" : start.getTime(),
        "questionNumber" : 1,
        "score": 0
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
    var questionNumber = parseInt(session.attributes.questionNumber);
    console.log("In AnswerRequest, baseNumber is "+baseNumber);
    if (userAnswer === (baseNumber * baseNumber)) {
        //correct answer
        speechOutput = "That is correct.";
        var endTime = new Date();
        var timeTaken = (endTime.getTime() - session.attributes.questionAskTime)/1000 - 5 /* hack.  it takes 5 seconds to read the question */;
        var points = Math.max(Math.ceil(Math.pow(10, GAME_DIGITS) - timeTaken), 1);
        speechOutput += " You took " + Math.floor(timeTaken) + " seconds.  You gained " + points + " points." ;
        currentScore += points;
        
    }
    else {
        speechOutput = "That is incorrect.  You answered " + userAnswer + ".  The correct answer is " + baseNumber * baseNumber + ".";
    }
    var lastQuestion = false;
    if (questionNumber===GAME_TOTAL_QUESTIONS) lastQuestion = true;
    speechOutput += " Your ";
    if (lastQuestion) speechOutput +=" final ";
    else speechOutput += " total ";
    speechOutput += "score after " + questionNumber + " ";
    if (questionNumber===1) speechOutput += "question ";
    else speechOutput += "questions ";
    speechOutput += " is " + currentScore + ". ";
    
    var quest;   
    if (lastQuestion) {
        speechOutput += "Thank you for playing.";
        callback(session.attributes,
            buildSpeechletResponseWithoutCard(speechOutput, "", true));
    }
    else {
        //not the last question 
        quest = generateNextQuestion(questionNumber+1);
        var start = new Date();
        speechOutput += quest.spokenQuestion;
        sessionAttributes = {
            "baseNumber": quest.baseNumber,
            "questionAskTime" : start.getTime(),
            "questionNumber" : questionNumber+1,
            "score": currentScore
        };
        callback(sessionAttributes,
            buildSpeechletResponse(CARD_TITLE, speechOutput, quest.repromptText, lastQuestion));
    }
}

function handleRepeatRequest(intent, session, callback) {
    // Repeat the previous speechOutput and repromptText from the session attributes if available
    // else start a new game session
    if (!session.attributes || !session.attributes.speechOutput) {
        getWelcomeResponse(callback);
    } else {
        callback(session.attributes,
            buildSpeechletResponseWithoutCard(session.attributes.speechOutput, session.attributes.repromptText, false));
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

    var speechOutput = "",
        repromptText = "";
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
        outputSpeech: {
            type: "PlainText",
            text: output
        },
        card: {
            type: "Simple",
            title: title,
            content: output
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

