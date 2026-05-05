## External UCI engines (Fairy-Stockfish, etc.)

ShatrunZ can run with the bundled C engine by default, or an **external UCI engine** (recommended for stronger play and variant research).

Important: because ShatrunZ is a **9×9 variant with Krishna**, standard Stockfish will not understand the rules. Use a **variant-capable** engine such as Fairy-Stockfish.

### Backend configuration (recommended first step)

Set these environment variables before running `python start.py`:

- **`UCI_ENGINE_PATH`**: path to the UCI engine binary to launch
- **`UCI_ENGINE_INIT`**: newline-separated UCI commands to send after startup

Example (Fairy-Stockfish-style):

```bash
export UCI_ENGINE_PATH="/path/to/fairy-stockfish"
export UCI_ENGINE_INIT=$'setoption name UCI_Variant value shatrunz'
python start.py
```

Then verify:

```bash
curl http://localhost:8000/api/health
```

You should see `engine_kind: "external_uci"`.

### How move sync works
The frontend sends a running UCI move list to the backend, and the backend asks the engine using:

```
position startpos moves <moves...>
go depth <d>
```

This keeps the engine in sync with the real game position without needing `position fen`.

### Next step (future)
If you want “true” engine interoperability (analysis boards, imports), we can add a **variant FEN serializer** and/or support Fairy-Stockfish variant definitions more explicitly.

