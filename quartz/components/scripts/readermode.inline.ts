let isReaderMode = false
let floatingExitButton: HTMLButtonElement | null = null

const emitReaderModeChangeEvent = (mode: "on" | "off") => {
  const event: CustomEventMap["readermodechange"] = new CustomEvent("readermodechange", {
    detail: { mode },
  })
  document.dispatchEvent(event)
}

const createFloatingExitButton = (switchFn: () => void) => {
  if (floatingExitButton) return

  floatingExitButton = document.createElement("button")
  floatingExitButton.className = "readermode-exit"
  floatingExitButton.setAttribute("aria-label", "Exit reader mode")
  floatingExitButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  `
  floatingExitButton.addEventListener("click", switchFn)
  document.body.appendChild(floatingExitButton)
}

const removeFloatingExitButton = () => {
  if (floatingExitButton) {
    floatingExitButton.remove()
    floatingExitButton = null
  }
}

document.addEventListener("nav", () => {
  const switchReaderMode = () => {
    isReaderMode = !isReaderMode
    const newMode = isReaderMode ? "on" : "off"
    document.documentElement.setAttribute("reader-mode", newMode)
    emitReaderModeChangeEvent(newMode)

    if (isReaderMode) {
      createFloatingExitButton(switchReaderMode)
    } else {
      removeFloatingExitButton()
    }
  }

  for (const readerModeButton of document.getElementsByClassName("readermode")) {
    readerModeButton.addEventListener("click", switchReaderMode)
    window.addCleanup(() => readerModeButton.removeEventListener("click", switchReaderMode))
  }

  // Cleanup floating button on navigation
  window.addCleanup(() => removeFloatingExitButton())

  // Set initial state
  document.documentElement.setAttribute("reader-mode", isReaderMode ? "on" : "off")
})
