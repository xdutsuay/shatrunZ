# ShatrunZ Web (Modular)

This is the refactored, modular version of the ShatrunZ web application.

## Structure

- **`index.html`**: Main entry point. Links to `style.css` and `main.js`.
- **`main.js`**: Entry point for JavaScript. Initializes the UI.
- **`ui.js`**: Handles DOM interactions, event listeners, and rendering.
- **`game.js`**: Manages game state (board, turn, history, undo).
- **`ai.js`**: Contains the AI logic (Minimax, Alpha-Beta Pruning) and "Brain" (memory).
- **`rules.js`**: Pure logic for move validation and check detection.
- **`constants.js`**: Shared constants (Board size, Piece types, Colors).
- **`style.css`**: All styling for the application.

## How to Run

Because this project uses ES6 Modules (`import`/`export`), you cannot simply open `index.html` directly from the file system (file:// protocol) due to browser security policies (CORS).

**You must use a local web server.**

### Using Python (Recommended)
If you have Python installed:

1.  Open a terminal in this directory (`html/`).
2.  Run:
    ```bash
    python3 -m http.server
    ```
3.  Open your browser and go to `http://localhost:8000`.

### Using Node.js
If you have `http-server` installed:
```bash
npx http-server .
```

## Features
- **PvP**: Player vs Player.
- **PvAI**: Player vs AI (Black or White).
- **AIvAI**: Watch AI play against itself.
- **Hyper-Training**: Fast-forward self-play to train the AI's memory.
