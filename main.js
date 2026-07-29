// find our test button
const testButton = document.getElementById('sound-check');
// init our synth
const synth = new Tone.Synth().toDestination();

// do something when this button is clicked
testButton.addEventListener("click", playNote);

// function that runs when button is clicked
function playNote(){
    // play a not for a duration
    synth.triggerAttackRelease("c4", "8n");
}
