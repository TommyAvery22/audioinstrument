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