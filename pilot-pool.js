(function (window) {
  "use strict";
  window.addEventListener("DOMContentLoaded", async function () {
    var status = document.getElementById("pilotPoolStatus");
    var message = document.getElementById("pilotPoolMessage");
    var title = document.getElementById("pilotPoolTitle");
    if (!status || !message || !title) return;
    try {
      // Anonymous aggregate status only. Do not read invitations, sign in,
      // create accounts, submit the form, or start evaluations on page load.
      var capacity = await window.MondermanEvaluationCapacity.check();
      status.dataset.state = capacity.automaticAdmissionOpen ? "open" : "full";
      if (capacity.automaticAdmissionOpen) {
        status.textContent = "Available by invitation";
        message.textContent = "The evaluation pool admits ten organizations. An invitation and eligibility checks are required; availability is confirmed when you explicitly start your evaluation.";
      } else {
        status.textContent = "Evaluation pool filled";
        title.textContent = "The ten-organization evaluation pool is filled.";
        message.textContent = "You can request individual review below. Only Jason Adamson may approve a particular additional organization. Submitting a request does not grant access or start an evaluation.";
      }
    } catch (_error) {
      status.dataset.state = "unavailable";
      status.textContent = "Evaluation availability temporarily unavailable";
      message.textContent = "We could not confirm whether the evaluation pool has space. Please refresh and try again. You can still submit a request for review; submitting it does not grant access.";
    }
  });
})(window);
