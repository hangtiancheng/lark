const connection = navigator.connection;
connection.addEventListener("change", () => {
  console.log("Connection downlink", connection.downlink);
  console.log("Connection effectiveType", connection.effectiveType);
});

function workLoop() {
  console.log("Connection downlink", connection.downlink);
  console.log("Connection effectiveType", connection.effectiveType);
  requestIdleCallback(workLoop);
}
requestIdleCallback(workLoop);
