# The Book Adapter

This is my experiment with vibe coding


## Features

- **Book Adaptation**: Automatically adapts book content for English learners at different CEFR levels (A1-C2)
- **B1 Level Focus**: Specifically optimized for intermediate English learners
- **Modern Vocabulary**: Converts archaic and outdated language to contemporary expressions
- **Ollama Integration**: Uses local AI models through Ollama for text adaptation
- **Progress Tracking**: Saves intermediate results and allows resuming interrupted processes
- **Chunked Processing**: Handles large texts by processing them in manageable chunks
- **Customizable**: Configurable vocabulary level, sentence complexity, and output format

## Getting Started

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn
- **Ollama** installed on your system
  - Visit: https://ollama.ai/
  - Or run: `curl https://ollama.ai/install.sh | sh`
  - Pull a model: `ollama pull llama2` (or your preferred model)

### Installation

1. Install dependencies:
```bash
npm install
```

### Usage

#### Book Adaptation

1. Place your input book file (default: `./src/pg551.txt`)

2. Run the adaptation script with command line options:

**Basic usage (uses defaults):**
```bash
npm run adapt
```

**Custom configuration:**
```bash
npm run adapt -- --input ./mybook.txt --level A2 --output ./adapted_a2.txt
```

**Available options:**
- `-i, --input <file>` - Input book file (default: ./src/pg551.txt)
- `-o, --output <file>` - Output adapted file (default: ./books/adapted_b1.txt)
- `-l, --level <level>` - Target level: A1, A2, B1, B2, C1, C2 (default: B1)
- `-m, --model <model>` - Ollama model to use (default: gemma3n)
- `-c, --chunk-size <size>` - Text chunk size in characters (default: 1000)
- `--no-modern` - Disable modern vocabulary conversion
- `-h, --help` - Show help message

**Quick shortcuts:**
```bash
npm run adapt:a1     # Adapt to A1 level
npm run adapt:a2     # Adapt to A2 level
npm run adapt:b1     # Adapt to B1 level (default)
npm run adapt:b2     # Adapt to B2 level
npm run adapt:help   # Show help
```

### Development

- **Build the project**: `npm run build`
- **Run book adaptation**: `npm run adapt`
- **Run compiled adaptation**: `npm run adapt:build`
- **Run in development mode**: `npm run dev`
- **Run the compiled application**: `npm start`
- **Run tests**: `npm test`
- **Clean build directory**: `npm run clean`

### Project Structure

```
├── src/           # Source code
├── dist/          # Compiled output
├── package.json   # Dependencies and scripts
├── tsconfig.json  # TypeScript configuration
└── jest.config.js # Test configuration
```

## Scripts

- `build` - Compile TypeScript to JavaScript
- `start` - Run the compiled application
- `dev` - Run the application in development mode with ts-node
- `clean` - Remove the dist directory
