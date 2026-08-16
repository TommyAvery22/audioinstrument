// browser loads html > browser loads javascript > open the dialog >
// user closes dialog > audio system loads > user clicks sound button

// find our dialog
const introDialog = document.getElementById("intro-dialog");
// find the close button
const introDialogCloseButton = document.getElementById("intro-dialog-close");
// show the found element in our browser console
// console.log(introDialog);
// find our test button
const testButton = document.getElementById('sound-check');
// init our synth
const synth = new Tone.Synth();

////// Dialog
// show dialog on page load
introDialog.showModal();
// close dialog when user clicks
introDialogCloseButton.addEventListener("click", function closeIntroDialog() {
    introDialog.close();
});
// whenever dialog closes, initialise the audio system
introDialog.addEventListener("close", toneInit);


// we put the whole function inside of the event listener instead as its only called there
// function closeIntroDialog(){


//}

////// Tone
// run to setup our audio system
function ToneInit(){
    synth.connect(Tone.Destination);
}

// do something when this button is clicked
testButton.addEventListener("click", playNote);

// function that runs when button is clicked
function playNote(){
    // play a not for a duration
    synth.triggerAttackRelease("c4", "8n");
}
