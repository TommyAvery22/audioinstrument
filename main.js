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
