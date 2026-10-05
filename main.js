////// Dialog
// find our dialog
const introDialog = document.getElementById("intro-dialog");
// find the close button
const introDialogCloseButton = document.getElementById("intro-dialog-close");

// show dialog on page load
introDialog.showModal();
// close dialog when user clicks
introDialogCloseButton.addEventListener("click", function closeIntroDialog() {
    introDialog.close();
});

////// Players
const players = [
    {
        name: "Player One",
        id: "one",
        // home row plays low notes, the row above plays the same notes an octave up
        noteKeys: {
            KeyA: "C3", KeyS: "D3", KeyD: "E3", KeyF: "G3", KeyG: "A3",
            KeyQ: "C4", KeyW: "D4", KeyE: "E4", KeyR: "G4", KeyT: "A4"
        },
        // bottom row changes the sound instead of playing notes
        controlKeys: {
            KeyZ: "darker", KeyX: "brighter", KeyC: "wave", KeyV: "lessEcho", KeyB: "moreEcho"
        }
    },
    {
        name: "Player Two",
        id: "two",
        // player two plays an octave higher so the two players can hear which notes are theirs
        noteKeys: {
            KeyH: "C4", KeyJ: "D4", KeyK: "E4", KeyL: "G4", Semicolon: "A4",
            KeyY: "C5", KeyU: "D5", KeyI: "E5", KeyO: "G5", KeyP: "A5"
        },
        controlKeys: {
            KeyN: "darker", KeyM: "brighter", Comma: "wave", Period: "lessEcho", Slash: "moreEcho"
        }
    }
];

// give every player an empty list of the note keys they're holding down
players.forEach(function(player){
    player.heldKeys = new Set();
    // filter cutoff in hertz, lower is darker
    player.cutoff = 1200;
    // how much echo, from 0 to 1
    player.echo = 0.2;
    // position in the waves list
    player.waveIndex = 0;
});

// find which player owns a key and whether it plays a note or changes a control
function findKey(code){
    // check each player in turn, and stop as soon as the key is found
    for (let player of players) {
        if(player.noteKeys[code]){
            return { player: player, type: "note", value: player.noteKeys[code] };
        }
        if(player.controlKeys[code]){
            return { player: player, type: "control", value: player.controlKeys[code] };
        }
    }
    // the key doesn't belong to either player
    return null;
}

// keys that aren't letters, and the character printed on them
const symbolLabels = { Semicolon: ";", Comma: ",", Period: ".", Slash: "/" };

// turn e.code into the character printed on the key, or the letter if it's a letter key
function keyLabel(code){
    if(symbolLabels[code]){
        return symbolLabels[code];
    }
    return code.replace("Key", "");
}

////// Tone
// keys don't make sound until the audio system is ready
let audioReady = false;

// run to setup audio system
async function toneInit(){
    // browsers block sound until the user clicks something, closing the dialog counts
    // await waits for tone to finish starting before moving on
    await Tone.start();
    buildSound();
    audioReady = true;
    console.log("audio ready");
}

// whenever dialog closes, initialise the audio system
introDialog.addEventListener("close", toneInit);

// the shared reverb, made in buildSound
let reverb;

// oscillator shapes a player can cycle through
const waves = ["triangle", "square", "sawtooth", "sine"];

// give each player their own synth so both can play at the same time
function buildSound(){
    // both players share the same reverb
    reverb = new Tone.Reverb({ decay: 4, wet: 0.3 });
    reverb.connect(Tone.Destination);
    players.forEach(function(player){
        // poly synth so a player can hold more than one note at once
        player.synth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: waves[player.waveIndex] },
            // turns each synth down so they don't get too loud when both players are playing
            volume: -12
        });
        // each player's sound goes: synth > filter > echo > shared reverb
        player.filter = new Tone.Filter(player.cutoff, "lowpass");
        player.delay = new Tone.FeedbackDelay("8n", 0.4);
        player.delay.wet.value = player.echo;
        player.synth.chain(player.filter, player.delay, reverb);
    });
}

// play a note on a player's synth
function startNote(player, note){
    player.synth.triggerAttack(note);
}

// stop a note on a player's synth
function endNote(player, note){
    player.synth.triggerRelease(note);
}

// change a player's sound when they press one of their bottom row keys
function changeControl(player, action){
    if(action === "darker"){
        player.cutoff = Math.max(200, player.cutoff / 1.5);
    } else if(action === "brighter"){
        player.cutoff = Math.min(8000, player.cutoff * 1.5);
    } else if(action === "wave"){
        // go to the next wave, back to the start after the last one
        player.waveIndex = (player.waveIndex + 1) % waves.length;
    } else if(action === "lessEcho"){
        player.echo = Math.max(0, player.echo - 0.1);
    } else if(action === "moreEcho"){
        player.echo = Math.min(0.8, player.echo + 0.1);
    }
    // rampTo smooths each change so it doesn't click
    player.filter.frequency.rampTo(player.cutoff, 0.1);
    player.delay.wet.rampTo(player.echo, 0.1);
    player.synth.set({ oscillator: { type: waves[player.waveIndex] } });
}

////// Keyboard
// runs every time any key is pressed down
function keyDown(e){
    // the browser repeats keydown while a key is held, only the first one should play
    if(e.repeat === true || audioReady === false){
        return;
    }
    // find which player owns this key
    let found = findKey(e.code);
    // ignore keys that don't belong to either player
    if(found === null){
        return;
    }
    // stop keys like / opening the browser's quick find
    e.preventDefault();
    // remember note keys as held until they're let go
    // note keys are remembered as held and start playing
    if(found.type === "note"){
        found.player.heldKeys.add(e.code);
        startNote(found.player, found.value);
    }
    // control keys change the sound instead
    if(found.type === "control"){
        changeControl(found.player, found.value);
    }
    console.log(found.player.name, "holding", found.player.heldKeys);
}

// runs every time any key is let go
function keyUp(e){
    let found = findKey(e.code);
    // only let go of note keys that were actually held
    if(found === null || found.type !== "note" || found.player.heldKeys.has(e.code) === false){
        return;
    }
    found.player.heldKeys.delete(e.code);
    endNote(found.player, found.value);
}

window.addEventListener("keyup", keyUp);
window.addEventListener("keydown", keyDown);