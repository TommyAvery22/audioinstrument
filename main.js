// browser loads html > browser loads javascript > open the dialog >
// user closes dialog > audio system loads > user clicks sound button

// find our dialog
const introDialog = document.getElementById('intro-dialog');
// find the close button
const introDialogCloseButton = document.getElementById('intro-dialog-close');
// show the found element in our browser console
// console.log(introDialog);
// find our test button
const testButton = document.getElementById('sound-check');
// find my key button for testing
const key = document.getElementById('key-test');
// init our synth
const synth = new Tone.Synth();
// changed this to poly synth
const synth = new Tone.PolySynth();
// is the user currently holding down the key?
let mouseButtonHeld = false;
// if user holds down the key, set to true, then if they let it up, set to false
window.addEventListener("mousedown", function() {
    mouseButtonHeld = true;
});

window.addEventListener("mouseup", function() {
    mouseButtonHeld = false;
});

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
//testButton.addEventListener("click", playNote);

// function that runs when button is clicked
function playNote(){
    // play a not for a duration
    synth.triggerAttackRelease("c4", "8n");
}

function playDataNote(e){
    console.log(e);
    let buttonClicked = e.target;
    //console.log(buttonClicked)
    let note = buttonClicked.dataset.note;
    //console.log(note);
    synth.triggerAttackRelease("d4", "8n");
}

function startNote(e){
    // find key that was clicked
    let keyPressed = e.target;
    // find the note associated with the key
    let note = keyPressed.dataset.note;
    synth.triggerAttack(note);
}

function endNote(e){
    let keyPressed = e.target;
    let note = keyPressed.dataset.note;
    synth.triggerRelease(note);
}

key.addEventListener("mousedown", startNote);
key.addEventListener("mouseup", endNote)
key.addEventListener("mouseleave", endNote)

// if user is holding mouse button down when they enter the key, play the note
key.addEventListener("mouseenter", function(e){
    if (mouseButtonHeld == true) {
        startNote(e);
    }
});

//key.addEventListener("click", playDataNote);
//testButton.addEventListener("click", playDataNote);

oscSlider.addEventListener("change", changeOsc);

// spatial control section
const flowerPainting = document.getElementById("flower-painting");

flowerPainting.addEventListener("mouseenter", startNote);
flowerPainting.addEventListener("mouseleave", endNote);

function pitchBend(e){
    console.log(e.layerX);
    synth.set({
        detune: e.layerX
    });
}

function randomTime(){
    let trackLength = audioTrack.duration;
    audioTrack.currentTime = trackLength * Math.random();
}
randomButton.addEventListener("click", randomTime);

playButton.addEventListener("click", playPauseAudio);

// set slider to change oscillator
const oscSlider = document.getElementById("osc-range");

function changeOsc(e){
    console.log(e.target.value);
    if(e.target.value > 50){
        synth.set({
            oscillator: {
                type: "square"
            }
        })
    } else {
        synth.set({
            oscillator: {
                type: "sine"
            }
        })
    }
}



oscSlider.addEventListener("change", changeOsc);

flowerPainting.addEventListener("mousemove", pitchBend);

// what is the current instant
let currentInstant = Temporal.Now.instant();
// find our time zone
let timeZone = currentInstant.timeZoneID();
console.log(currentInstant);
// convert to local time
let currentTime = currentInstant.toZonedDateTimeISO(timeZone);
console.log(currentTime);