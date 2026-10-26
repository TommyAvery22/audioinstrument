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

// find the help button
const helpButton = document.getElementById("help-button");
// open the how to play dialog again when the help button is clicked
helpButton.addEventListener("click", function openIntroDialog() {
    introDialog.showModal();
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

// player 2's keys, in order, pick how distorted player 1 sounds, from 0 (clean) to 1 (very crunchy)
    // the home row is gentler, the top row is dirtier
    const distortionAmounts = [0.2, 0.25, 0.3, 0.35, 0.4, 0.6, 0.7, 0.8, 0.9, 1];
    // the distortion on player 1's sound, made in buildSound
    let distortion;
    // like a guitar pedal: boost the sound going into the distortion so it really crunches,
    // then turn it back down coming out so it gets grittier without getting louder
    let distortionBoost;
    let distortionCut;
    // how much to boost going in, and how much to turn down coming out (measured so the volume stays about the same)
    const boostAmount = 8;
    const cutAmount = 1 / 6.5;
    // player 1's keys, in order, pick how fast player two's sound wobbles, in wobbles per second
    const wobbleRates = [0.5, 1, 2, 3, 4, 6, 8, 10, 12, 16];
    // the wobbling filter on player 2's sound, made in buildSound
    let autoFilter;

// what each player's partner is doing to their sound right now, read by the influence meters
// player 1's sound is distorted while player 2 plays, distortionAmount is how much player 2 picked
players[0].distorted = false;
players[0].distortionAmount = 0;
// player 2's sound wobbles while player 1 plays, wobbleRate is how many wobbles per second
players[1].wobbling = false;
players[1].wobbleRate = 2;

// give every player an empty list of the note keys they're holding down
players.forEach(function(player){
    player.heldKeys = new Set();
    // filter cutoff in hertz, lower is darker
    player.cutoff = 1400;
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
    // the dialog can be closed more than once now, but the audio only needs setting up the first time
    if(audioReady === true){
        return;
    }
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
        player.synth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: waves[player.waveIndex] },
            // turns each synth down so they don't get too loud when both players are playing
            volume: -12
        });
        // each player's sound goes: synth > filter > echo > shared reverb
        player.filter = new Tone.Filter(player.cutoff, "lowpass");
        player.delay = new Tone.FeedbackDelay("8n", 0.4);
        player.delay.wet.value = player.echo;
                
        if(player.id === "two"){
            // an auto filter sweeps up and down by itself, depth 0 means no wobble until player one plays
            autoFilter = new Tone.AutoFilter({ frequency: 2, baseFrequency: 250, octaves: 4, depth: 0 }).start();
            // player two's sound goes: synth > wobble > filter > echo > shared reverb
            player.synth.chain(autoFilter, player.filter, player.delay, reverb);
        } else {
            // distortion adds grit, wet 0 means player 1 sounds clean until player two plays
            distortion = new Tone.Distortion({ distortion: 0.4, wet: 0 });
            // the boost and cut start at 1, so nothing changes until player two plays
            distortionBoost = new Tone.Gain(1);
            distortionCut = new Tone.Gain(1);
            // player one's sound goes: synth > boost > distortion > cut > filter > echo > shared reverb
            // the filter comes after the distortion so the darker setting can soften the crunch
            player.synth.chain(distortionBoost, distortion, distortionCut, player.filter, player.delay, reverb);
        }
    });
}

// play a note on a player's synth, and change the other player's sound
function startNote(player, note){
    player.synth.triggerAttack(note);

    if(player.id === "one"){
        // find which of player one's keys this note is, and set how fast player two wobbles
        let index = Object.values(player.noteKeys).indexOf(note);
        autoFilter.frequency.rampTo(wobbleRates[index], 0.2);
        autoFilter.depth.rampTo(1, 0.3);
        // remember the wobble so player 2's meter can show it
        players[1].wobbling = true;
        players[1].wobbleRate = wobbleRates[index];
    }

    if(player.id === "two"){
        // find which of player 2's keys this note is, and pick how distorted player 1 sounds
        let index = Object.values(player.noteKeys).indexOf(note);
        distortion.distortion = distortionAmounts[index];
        distortion.wet.rampTo(1, 0.1);
        // drive the distortion hard and turn it back down afterwards, so it's gritty rather than just louder
        distortionBoost.gain.rampTo(boostAmount, 0.1);
        distortionCut.gain.rampTo(cutAmount, 0.1);
        // remember the distortion so player 1's meter can show it
        players[0].distorted = true;
        players[0].distortionAmount = distortionAmounts[index];
    }
}

// stop a note on a player's synth, and let the other player's sound go back to normal
function endNote(player, note){
    player.synth.triggerRelease(note);
    // player 1 goes back to a clean sound once player 2 lets go of every key
    if(player.id === "two" && player.heldKeys.size === 0){
        distortion.wet.rampTo(0, 0.3);
        distortionBoost.gain.rampTo(1, 0.3);
        distortionCut.gain.rampTo(1, 0.3);
        players[0].distorted = false;
    }

    // player 2 stops wobbling once player one lets go of every key
    if(player.id === "one" && player.heldKeys.size === 0){
        autoFilter.depth.rampTo(0, 0.3);
        players[1].wobbling = false;
    }
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
const controlNames = { darker: "darker", brighter: "brighter", wave: "wave", lessEcho: "less echo", moreEcho: "more echo" };
// a symbol for each control so it can be recognised at a glance, the name sits underneath
const controlSymbols = { darker: "☾", brighter: "☀", wave: "∿", lessEcho: "(·)", moreEcho: "((·))" };
// which group each control belongs to, so related controls sit together under one value
const controlGroups = { darker: "brightness", brighter: "brightness", wave: "wave", lessEcho: "echo", moreEcho: "echo" };

// a box that holds related control keys, with the group's name and current value underneath
function buildControlGroup(player, groupName){
    let group = document.createElement("div");
    group.className = "control-group";
    // data-group says which setting to show, data-player gives the group its player's colour
    group.dataset.group = groupName;
    group.dataset.player = player.id;

    let keys = document.createElement("div");
    keys.className = "group-keys";

    let value = document.createElement("div");
    value.className = "group-value";
    let name = document.createElement("span");
    name.className = "group-name";
    name.textContent = groupName;
    let number = document.createElement("span");
    number.className = "group-number";
    value.append(name, number);

    group.append(keys, value);
    return group;
}

// describe how distorted player 1 is in plain words instead of a number
function distortionName(distortionAmount){
    if(distortionAmount <= 0.3){
        return "low";
    }
    if(distortionAmount <= 0.6){
        return "medium";
    }
    return "high";
}

// describe player 2's wobble speed in plain words instead of a number
function wobbleName(wobbleRate){
    if(wobbleRate <= 2){
        return "slow";
    }
    if(wobbleRate <= 6){
        return "medium";
    }
    return "fast";
}

// what each player's influence meter shows: player one's sound gets distorted, player two's sound wobbles
const meterInfo = {
    one: { symbol: "⚡", name: "distortion", visual: "meter-fill", readout: "off", caption: "player 2 controls this" },
    two: { symbol: "∿", name: "wobble", visual: "meter-dot", readout: "off", caption: "player 1 controls this" }
};

// make a meter that shows what a player's partner is doing to their sound
function buildMeter(player){
    let info = meterInfo[player.id];
    let meter = document.createElement("div");
    meter.className = "meter";
    // the meter is drawn in the partner's colour, because it shows the partner's influence
    if(player.id === "one"){
        meter.dataset.player = "two";
    } else {
        meter.dataset.player = "one";
    }

    // top line: symbol, name, and who's causing it
    let heading = document.createElement("div");
    heading.className = "meter-heading";
    let symbol = document.createElement("span");
    symbol.className = "meter-symbol";
    symbol.textContent = info.symbol;
    let name = document.createElement("span");
    name.className = "meter-name";
    name.textContent = info.name;
    let caption = document.createElement("span");
    caption.className = "meter-caption";
    caption.textContent = info.caption;
    heading.append(symbol, name, caption);

    // bottom line: a bar that fills (ring) or a dot that moves (wobble), and a word describing it
    let body = document.createElement("div");
    body.className = "meter-body";
    let track = document.createElement("div");
    track.className = "meter-track";
    let visual = document.createElement("div");
    visual.className = info.visual;
    track.append(visual);
    let readout = document.createElement("span");
    readout.className = "meter-readout";
    readout.textContent = info.readout;
    body.append(track, readout);

    meter.append(heading, body);
    // remember the parts that change, so updateDisplay can find them later
    player.meterVisual = visual;
    player.meterReadout = readout;
    return meter;
}

// draw the meters and the keyboard on screen, each key coloured by the player who owns it
function buildDisplay(){
    // the meters sit in a row above the keyboard, one over each player's half
    let meters = document.createElement("div");
    meters.className = "meters";
    players.forEach(function(player){
        meters.append(buildMeter(player));
    });

    let keyboard = document.createElement("div");
    keyboard.className = "keyboard";

    keyboardRows.forEach(function(codes){
        let row = document.createElement("div");
        row.className = "keyboard-row";

        codes.forEach(function(code){
            // find who owns this key and what it does
            let found = findKey(code);
            let key = document.createElement("div");
            // the class is "key note" or "key control" so the css can style them differently
            key.className = "key " + found.type;
            // data-code finds this key again when it's pressed
            key.dataset.code = code;
            // data-player gives the key its player's colour
            key.dataset.player = found.player.id;

            let letter = document.createElement("kbd");
            letter.textContent = keyLabel(code);
            // control keys show a symbol above their name
            let symbol = document.createElement("span");
            symbol.className = "symbol";
            let label = document.createElement("span");
            label.className = "label";

            key.append(letter, symbol, label);

            if(found.type === "control"){
                // controls are grouped by what they change, e.g. darker and brighter both change brightness
                let groupName = controlGroups[found.value];
                let group = row.lastElementChild;
                // start a new group when this key belongs to a different group or player than the last one
                if(group === null || group.dataset.group !== groupName || group.dataset.player !== found.player.id){
                    group = buildControlGroup(found.player, groupName);
                    row.append(group);
                }
                group.querySelector(".group-keys").append(key);
            } else {
                row.append(key);
            }
        });
        keyboard.append(row);
    });

    // the meters and keyboard are grouped so the meters line up with the keyboard's width
    let instrument = document.createElement("div");
    instrument.className = "instrument";
    instrument.append(meters, keyboard);
    stage.append(instrument);
}

// write what each key does on it
function updateDisplay(){
    // find every key on the drawn keyboard
    let keys = document.querySelectorAll(".key");
    keys.forEach(function(key){
        let found = findKey(key.dataset.code);
        let label = key.querySelector(".label");
        if(found.type === "note"){
            // note keys show their note
            label.textContent = found.value;
            // light up note keys while they're held
            key.classList.toggle("held", found.player.heldKeys.has(key.dataset.code));
            // the trail lasts longer the more echo the player has, from 1 to 4 seconds
            let trail = 1 + found.player.echo * 4;
            key.style.setProperty("--trail", trail + "s");
        } else {
            // control keys show a symbol for what they change, with its name underneath
            key.querySelector(".symbol").textContent = controlSymbols[found.value];
            label.textContent = controlNames[found.value];
        }
    });

    // write the current setting under each group of controls
    let groups = document.querySelectorAll(".control-group");
    groups.forEach(function(group){
        let player = players[0];
        if(group.dataset.player === "two"){
            player = players[1];
        }
        let number = group.querySelector(".group-number");
        if(group.dataset.group === "brightness"){
            // the filter cutoff in hertz, higher is brighter
            number.textContent = Math.round(player.cutoff) + "hz";
        } else if(group.dataset.group === "echo"){
            // how much echo, as a percentage
            number.textContent = Math.round(player.echo * 100) + "%";
        } else if(group.dataset.group === "wave"){
            // the name of the wave shape the player is on
            number.textContent = waves[player.waveIndex];
        }
    });

    // the influence meters show what each player's partner is doing to their sound
    let one = players[0];
    let two = players[1];

    // player 1's distortion bar fills up to however much distortion player 2 picked
    if(one.distorted === true){
        one.meterVisual.style.width = (one.distortionAmount * 100) + "%";
        one.meterReadout.textContent = distortionName(one.distortionAmount);
    } else {
        one.meterVisual.style.width = "0%";
        one.meterReadout.textContent = "off";
    }

    // player 2's wobble dot bounces at the real wobble speed while player 1 is playing
    if(two.wobbling === true){
        // one wobble is the dot going there and back, so it takes 1 divided by the rate in seconds
        two.meterVisual.style.setProperty("--wobble-time", (1 / two.wobbleRate) + "s");
        two.meterVisual.classList.add("wobbling");
        two.meterReadout.textContent = wobbleName(two.wobbleRate);
    } else {
        two.meterVisual.classList.remove("wobbling");
        two.meterReadout.textContent = "off";
    }

    // the background softly takes on the colour of whoever is playing more notes right now
    let oneNotes = one.heldKeys.size;
    let twoNotes = two.heldKeys.size;
    let totalNotes = oneNotes + twoNotes;
    if(totalNotes === 0){
        // nobody is playing, so go back to the normal background from the css
        document.body.style.backgroundColor = "";
    } else {
        // how much of the blend is player 1's colour, e.g. 2 notes to 1 is 67% player 1
        let onePercent = Math.round(oneNotes / totalNotes * 100);
        let blend = "color-mix(in srgb, var(--player-one) " + onePercent + "%, var(--player-two))";
        // only a light tint, so it stays in the background and the keys are still easy to read
        document.body.style.backgroundColor = "color-mix(in srgb, " + blend + " 12%, var(--colour-01))";
    }
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