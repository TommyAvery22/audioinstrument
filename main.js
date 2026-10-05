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
        name: "Player 1",
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
        name: "Player 2",
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
    startClock();
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

////// Turns
// whose turn it is, player one goes first
let currentTurn = "one";
// how many seconds each player gets per turn
const turnLength = 6;
// seconds left in the current turn
let timeLeft = turnLength;

// hand the turn to the other player, and stop the notes of the player whose time is up
function switchTurn(){
    let outgoing = players[0];
    if(currentTurn === "two"){
        outgoing = players[1];
    }
    outgoing.heldKeys.clear();
    outgoing.synth.releaseAll();

    if(currentTurn === "one"){
        currentTurn = "two";
    } else {
        currentTurn = "one";
    }
    // the clock starts again for the next player
    timeLeft = turnLength;
}

// the metronome sound, made in startClock
let tick;

// count down once a second, and swap turns when the clock runs out
function startClock(){
    // a short high click, like a metronome
    tick = new Tone.Synth({
        oscillator: { type: "triangle" },
        envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 },
        volume: -10
    });
    tick.connect(Tone.Destination);
    // a higher tick marks the start of the first turn
    tick.triggerAttackRelease("G6", "32n");

    // tone's loop keeps steadier time than setInterval, because it's timed by the audio clock
    let loop = new Tone.Loop(function(time){
        timeLeft = timeLeft - 1;
        if(timeLeft === 0){
            switchTurn();
            // a higher tick marks the start of a new turn
            tick.triggerAttackRelease("G6", "32n", time);
        } else {
            tick.triggerAttackRelease("C6", "32n", time);
        }
        // update the screen at the moment the second actually passes
        Tone.getDraw().schedule(updateDisplay, time);
    }, 1);
    // the first second passes one second after the clock starts
    loop.start(1);
    Tone.getTransport().start();
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
        // ignore notes from the player whose turn it isn't
        if(found.player.id !== currentTurn){
            return;
        }
        found.player.heldKeys.add(e.code);
        startNote(found.player, found.value);
    }
    // control keys change the sound instead
    if(found.type === "control"){
        changeControl(found.player, found.value);
    }
    updateDisplay();
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
    updateDisplay();
}

window.addEventListener("keyup", keyUp);
window.addEventListener("keydown", keyDown);

////// Display
// find the empty stage in the html
const stage = document.getElementById("stage");
// find the countdown clock
const clock = document.getElementById("clock");

// make a section for each player with their name and a line of status text
function buildDisplay(){
    players.forEach(function(player){
        let section = document.createElement("section");
        section.className = "player";
        // data-player picks up the player's colour from the css
        section.dataset.player = player.id;

        let heading = document.createElement("h2");
        heading.textContent = player.name;
        let status = document.createElement("p");

        section.append(heading, status);
        stage.append(section);
        // remember the status line so it can be updated later
        player.statusElement = status;
    });
}

// write what each player is playing and how their sound is set
function updateDisplay(){
    // show the seconds left, in the colour of whose turn it is
    clock.textContent = timeLeft;
    clock.dataset.player = currentTurn;

    players.forEach(function(player){
        // turn the held keys into a list of notes
        let notes = [];
        player.heldKeys.forEach(function(code){
            notes.push(player.noteKeys[code]);
        });
        let playing = "nothing";
        if(notes.length > 0){
            playing = notes.join(" ");
        }
        // say whose turn it is
        let turn = "waiting";
        if(currentTurn === player.id){
            turn = "your turn";
        }
        player.statusElement.textContent =
            turn +
            " · playing: " + playing +
            " · wave: " + waves[player.waveIndex] +
            " · brightness: " + Math.round(player.cutoff) + "hz" +
            " · echo: " + Math.round(player.echo * 100) + "%";
    });
}

buildDisplay();
updateDisplay();