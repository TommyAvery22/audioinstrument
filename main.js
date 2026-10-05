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
        // home row plays C3 up to A4, the row above is the same notes an octave up
        noteKeys: {
            KeyA: "C3", KeyS: "D3", KeyD: "E3", KeyF: "G3", KeyG: "A3",
            KeyH: "C4", KeyJ: "D4", KeyK: "E4", KeyL: "G4", Semicolon: "A4",
            KeyQ: "C4", KeyW: "D4", KeyE: "E4", KeyR: "G4", KeyT: "A4",
            KeyY: "C5", KeyU: "D5", KeyI: "E5", KeyO: "G5", KeyP: "A5"
        },
        // bottom row changes the sound instead of playing notes
        // player 1 only changes the wave, the tone belongs to player two
        controlKeys: {
            KeyC: "wave"
        }
    },
    {
        name: "Player 2",
        id: "two",
        // player 2 plays with the mouse instead of the keyboard, so they have no keys
        noteKeys: {},
        controlKeys: {}
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

// player one's wave key cycles through the oscillator shapes
function changeControl(player, action){
    if(action === "wave"){
        // go to the next wave, back to the start after the last one
        player.waveIndex = (player.waveIndex + 1) % waves.length;
        player.synth.set({ oscillator: { type: waves[player.waveIndex] } });
    }
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

// the three letter rows of a qwerty keyboard, top to bottom
const keyboardRows = [
    ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP"],
    ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon"],
    ["KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM", "Comma", "Period", "Slash"]
];

// readable names for the control keys
const controlNames = { darker: "darker", brighter: "brighter", wave: "change wave", lessEcho: "less echo", moreEcho: "more echo" };

// draw the keyboard on screen, each key coloured by the player who owns it
function buildDisplay(){
    let keyboard = document.createElement("div");
    keyboard.className = "keyboard";

    keyboardRows.forEach(function(codes){
        let row = document.createElement("div");
        row.className = "keyboard-row";

        codes.forEach(function(code){
            // find who owns this key and what it does
            let found = findKey(code);
            let key = document.createElement("div");
            // data-code finds this key again when it's pressed
            key.dataset.code = code;
            // keys nobody owns are drawn faded
            if(found === null){
                key.className = "key unused";
            } else {
                key.className = "key " + found.type;
                // data-player gives the key its player's colour
                key.dataset.player = found.player.id;
            }

            let letter = document.createElement("kbd");
            letter.textContent = keyLabel(code);
            let label = document.createElement("span");
            label.className = "label";

            key.append(letter, label);
            row.append(key);
        });
        keyboard.append(row);
    });
    stage.append(keyboard);
    // player 2's pad, they move the mouse around inside it to shape the sound
    let pad = document.createElement("div");
    pad.id = "pad";
    pad.dataset.player = "two";
    // the dot shows where player two's mouse is
    let dot = document.createElement("div");
    dot.id = "pad-dot";
    let padLabel = document.createElement("p");
    padLabel.id = "pad-label";
    padLabel.textContent = "player 2's control box";
    // axis labels show what moving in each direction does
    let xAxis = document.createElement("p");
    xAxis.className = "pad-axis x-axis";
    xAxis.textContent = "← darker · brighter →";
    let yAxis = document.createElement("p");
    yAxis.className = "pad-axis y-axis";
    yAxis.textContent = "← less echo · more echo →";
    pad.append(dot, padLabel, xAxis, yAxis);

    stage.append(pad);
}

// write what each key does on it
function updateDisplay(){
    // find every key on the drawn keyboard
    let keys = document.querySelectorAll(".key");
    keys.forEach(function(key){
        let found = findKey(key.dataset.code);
        // skip keys nobody owns
        if(found === null){
            return;
        }
        let label = key.querySelector(".label");
        if(found.type === "note"){
            // note keys show their note
            label.textContent = found.value;
            // light up note keys while they're held
            key.classList.toggle("held", found.player.heldKeys.has(key.dataset.code));
        } else {
            // control keys show what they change
            label.textContent = controlNames[found.value];
        }
    });
}

// only light up keys while they're held, don't change the display when a control key is pressed
function showPressed(e){
    let key = document.querySelector('.control[data-code="' + e.code + '"]');
    if(key !== null){
        key.classList.add("pressed");
    }
}

function hidePressed(e){
    let key = document.querySelector('.control[data-code="' + e.code + '"]');
    if(key !== null){
        key.classList.remove("pressed");
    }
}

window.addEventListener("keydown", showPressed);
window.addEventListener("keyup", hidePressed);

buildDisplay();
updateDisplay();

////// Mouse
// find player two's pad and the things inside it
const pad = document.getElementById("pad");
const padDot = document.getElementById("pad-dot");
const padLabel = document.getElementById("pad-label");

// like the flower painting from class, the mouse's position in the pad changes the sound
function movePad(e){
    // offsetX and offsetY are how far the mouse is from the pad's top left corner, in pixels
    // dividing by the pad's size turns them into 0 (left or top) to 1 (right or bottom)
    let x = e.offsetX / pad.clientWidth;
    let y = e.offsetY / pad.clientHeight;

    // move the dot to the mouse
    padDot.style.left = (x * 100) + "%";
    padDot.style.top = (y * 100) + "%";

    if(audioReady === false){
        return;
    }
    // left to right: dark to bright, from 200hz to 8000hz
    // Math.pow makes each step sound even, because our ears hear pitch in multiples, not steps
    players[1].cutoff = 200 * Math.pow(40, x);
    // bottom to top: no echo to lots of echo, y is flipped because it counts down from the top
    players[1].echo = (1 - y) * 0.8;

    // player two's settings change player one's sound
    players[0].filter.frequency.rampTo(players[1].cutoff, 0.05);
    players[0].delay.wet.rampTo(players[1].echo, 0.05);

    padLabel.textContent = "brightness " + Math.round(players[1].cutoff) + "hz · echo " + Math.round(players[1].echo * 100) + "%";
}

pad.addEventListener("mousemove", movePad);