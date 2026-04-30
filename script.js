const serviceCards = Array.from(document.querySelectorAll("[data-service-card]"));
const serviceStatus = document.querySelector("[data-service-status]");

function setActiveService(service) {
  serviceCards.forEach((card) => {
    const isActive = card.id === service;
    card.classList.toggle("is-active", isActive);
  });

  if (!serviceStatus) {
    return;
  }

  if (service === "reserve") {
    serviceStatus.textContent = "Reservations are leading the first impression right now.";
    return;
  }

  if (service === "order") {
    serviceStatus.textContent = "Ordering is leading the first impression right now.";
    return;
  }

  serviceStatus.textContent = "Menu is leading the first impression right now.";
}

document.querySelectorAll("[data-service-trigger]").forEach((button) => {
  button.addEventListener("click", () => {
    const { serviceTrigger } = button.dataset;
    setActiveService(serviceTrigger || "menu");
  });
});
