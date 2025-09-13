import * as fs from 'fs';
import * as path from 'path';
const fetch = require('node-fetch');

interface BookAdaptationConfig {
  inputFile: string;
  outputFile: string;
  targetLevel: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  chunkSize: number;
  model: string;
  useModernVocabulary?: boolean;
}

class BookAdapter {
  private config: BookAdaptationConfig;

  constructor(config: BookAdaptationConfig) {
    this.config = config;
  }

  /**
   * Main method to adapt a book for English learners
   */
  async adaptBook(): Promise<void> {
    try {
      console.log(`📚 Starting book adaptation for ${this.config.targetLevel} level...`);
      
      // Read the input book
      const bookContent = this.readBookFile();
      
      // Split into manageable chunks
      const chunks = this.splitIntoChunks(bookContent);
      
      console.log(`📄 Book split into ${chunks.length} chunks`);
      
      // Check for existing progress
      const progressFile = this.config.outputFile.replace('.txt', '_progress.json');
      const existingProgress = this.loadProgress(progressFile);
      
      // Process each chunk with Ollama
      const adaptedChunks: string[] = [];
      let startIndex = existingProgress.completedChunks || 0;
      
      if (startIndex > 0) {
        console.log(`📂 Resuming from chunk ${startIndex + 1} (found existing progress)`);
        adaptedChunks.push(...existingProgress.adaptedChunks || []);
      }
      
      for (let i = startIndex; i < chunks.length; i++) {
        console.log(`🔄 Processing chunk ${i + 1}/${chunks.length}...`);
        
        try {
          const adaptedChunk = await this.adaptChunkWithOllama(chunks[i]);
          adaptedChunks.push(adaptedChunk);
          
          // Save progress after each chunk
          this.saveProgress(progressFile, {
            completedChunks: i + 1,
            totalChunks: chunks.length,
            adaptedChunks: adaptedChunks,
            lastUpdated: new Date().toISOString()
          });          
          
          // Add a small delay to avoid overwhelming the system
          await this.delay(500);
          
        } catch (error) {
          console.error(`❌ Error processing chunk ${i + 1}:`, error);
          console.log(`💾 Progress saved. You can resume later.`);
          throw error;
        }
      }
      
      // Combine and save the final adapted book
      const adaptedBook = adaptedChunks.join('\n\n');
      this.saveAdaptedBook(adaptedBook);

      console.log(`✅ Book adaptation completed! Output saved to: ${this.config.outputFile}`);
      
    } catch (error) {
      console.error('❌ Error during book adaptation:', error);
      throw error;
    }
  }

  /**
   * Read the input book file
   */
  private readBookFile(): string {
    if (!fs.existsSync(this.config.inputFile)) {
      throw new Error(`Input file not found: ${this.config.inputFile}`);
    }
    
    return fs.readFileSync(this.config.inputFile, 'utf-8');
  }

  /**
   * Split book content into manageable chunks
   */
  private splitIntoChunks(content: string): string[] {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const chunks: string[] = [];
    let currentChunk = '';
    
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > this.config.chunkSize) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? '. ' : '') + sentence.trim();
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  /**
   * Adapt a text chunk using Ollama API
   */
  private async adaptChunkWithOllama(chunk: string): Promise<string> {
    const prompt = this.createAdaptationPrompt(chunk);
    
    try {
      const response = await fetch('http://127.0.0.1:11434/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.7,
            max_tokens: 2000,
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { response?: string };
      return this.extractAdaptedText(data.response || '');
      
    } catch (error) {
      throw new Error(`Failed to call Ollama API: ${error}`);
    }
  }

  /**
   * Create adaptation prompt for Ollama
   */
  private createAdaptationPrompt(text: string): string {
    const levelDescriptions = {
      A1: 'very basic vocabulary (500-1000 most common words), simple present tense, very short sentences',
      A2: 'basic vocabulary (1000-2000 words), simple past and future tenses, short sentences',
      B1: 'intermediate vocabulary (2000-3000 words), various tenses, compound sentences, some complex structures',
      B2: 'good vocabulary range (3000-4000 words), complex sentences, various grammatical structures',
      C1: 'wide vocabulary range (4000+ words), complex and sophisticated structures',
      C2: 'very wide vocabulary, native-like complexity'
    };

    const modernVocabularyInstructions = this.config.useModernVocabulary ? `
- Use MODERN vocabulary and contemporary expressions instead of archaic or outdated words
- Replace old-fashioned terms with current, everyday language that people use today
- Use modern idioms and phrases that are commonly used in contemporary English
- Update cultural references to be more contemporary and relatable
- Use present-day terminology for technology, social concepts, and everyday items

Examples of modernization:
- "carriage" → "car" or "vehicle"
- "parlour" → "living room"
- "thee/thou" → "you"
- "upon" → "on"
- "whilst" → "while"
- "shall" → "will"` : '';

    return `Please rewrite the following text to be suitable for English learners at ${this.config.targetLevel} level. 

Guidelines for ${this.config.targetLevel} level:
- Use ${levelDescriptions[this.config.targetLevel]}${modernVocabularyInstructions}
- Maintain the original meaning and story flow
- Make the text engaging but accessible
- Replace difficult words with simpler alternatives
- Simplify complex sentence structures when needed
- Add brief explanations for cultural references if necessary

IMPORTANT: Provide ONLY the adapted text. Do not include any explanations, notes, commentary, or meta-text. Do not use asterisks, parentheses for comments, or phrases like "Note:", "Explanation:", "This has been simplified", etc. Just return the clean adapted story text.

Original text:
"${text}"

Adapted text:`;
  }

  /**
   * Extract the adapted text from Ollama's response
   */
  private extractAdaptedText(response: string): string {
    // Remove the prompt echo and extract just the adapted text
    const lines = response.split('\n');
    const adaptedLines: string[] = [];
    let foundAdaptedSection = false;
    let skipExplanations = false;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip empty lines at the start
      if (!foundAdaptedSection && !trimmedLine) continue;
      
      // Look for the adapted text section
      if (trimmedLine.includes('Adapted text') || foundAdaptedSection) {
        foundAdaptedSection = true;
        
        // Skip the section header line
        if (trimmedLine.includes('Adapted text')) continue;
        
        // Skip lines that look like explanations or meta-commentary
        if (trimmedLine.startsWith('*') || 
            trimmedLine.startsWith('Note:') || 
            trimmedLine.startsWith('Explanation:') ||
            trimmedLine.includes('simplified') ||
            trimmedLine.includes('adapted') ||
            trimmedLine.includes('modern') ||
            (trimmedLine.startsWith('(') && trimmedLine.endsWith(')'))) {
          continue;
        }
        
        // Add the actual content
        if (trimmedLine && !skipExplanations) {
          adaptedLines.push(trimmedLine);
        }
      }
    }
    
    // If we couldn't find a proper adapted section, return the whole response cleaned up
    if (adaptedLines.length === 0) {
      return response.trim()
        .replace(/\*.*?\*/g, '') // Remove text in asterisks
        .replace(/Note:.*$/gim, '') // Remove note lines
        .replace(/Explanation:.*$/gim, '') // Remove explanation lines
        .replace(/\(.*?\)/g, '') // Remove parenthetical comments
        .replace(/\n\s*\n/g, '\n') // Remove extra blank lines
        .trim();
    }
    
    return adaptedLines.join(' ').trim();
  }

  /**
   * Save the adapted book to file
   */
  private saveAdaptedBook(content: string): void {
    const outputDir = path.dirname(this.config.outputFile);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Add header with adaptation info
    const header = `# Adapted Book for ${this.config.targetLevel} English Learners\n\n` +
                  `*This book has been adapted using AI to match ${this.config.targetLevel} level vocabulary and grammar.*\n\n` +
                  `---\n\n`;
    
    fs.writeFileSync(this.config.outputFile, header + content, 'utf-8');
  }

  /**
   * Load progress from file
   */
  private loadProgress(progressFile: string): any {
    if (fs.existsSync(progressFile)) {
      try {
        const progressData = fs.readFileSync(progressFile, 'utf-8');
        return JSON.parse(progressData);
      } catch (error) {
        console.log(`⚠️  Could not read progress file, starting fresh`);
        return {};
      }
    }
    return {};
  }

  /**
   * Save progress to file
   */
  private saveProgress(progressFile: string, progress: any): void {
    const outputDir = path.dirname(progressFile);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2), 'utf-8');
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Parse command line arguments
 */
function parseCommandLineArgs(): BookAdaptationConfig {
  const args = process.argv.slice(2);
  
  const config: BookAdaptationConfig = {
    inputFile: './src/pg551.txt',
    outputFile: './books/adapted_b1.txt',
    targetLevel: 'B1',
    chunkSize: 1000,
    model: 'gemma3n',
    useModernVocabulary: true
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--input':
      case '-i':
        if (nextArg) {
          config.inputFile = nextArg;
          i++;
        }
        break;
      case '--output':
      case '-o':
        if (nextArg) {
          config.outputFile = nextArg;
          i++;
        }
        break;
      case '--level':
      case '-l':
        if (nextArg && ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(nextArg)) {
          config.targetLevel = nextArg as any;
          i++;
        }
        break;
      case '--model':
      case '-m':
        if (nextArg) {
          config.model = nextArg;
          i++;
        }
        break;
      case '--chunk-size':
      case '-c':
        if (nextArg && !isNaN(parseInt(nextArg))) {
          config.chunkSize = parseInt(nextArg);
          i++;
        }
        break;
      case '--no-modern':
        config.useModernVocabulary = false;
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;
    }
  }

  return config;
}

/**
 * Print usage information
 */
function printUsage(): void {
  console.log(`
📚 Book Adapter for English Learners

Usage: npm run adapt -- [options]

Options:
  -i, --input <file>        Input book file (default: ./src/pg551.txt)
  -o, --output <file>       Output adapted file (default: ./books/adapted_b1.txt)
  -l, --level <level>       Target level: A1, A2, B1, B2, C1, C2 (default: B1)
  -m, --model <model>       Ollama model to use (default: gemma3n)
  -c, --chunk-size <size>   Text chunk size in characters (default: 1000)
  --no-modern              Disable modern vocabulary conversion
  -h, --help               Show this help message

Examples:
  npm run adapt -- --input ./mybook.txt --level A2 --output ./adapted.txt
  npm run adapt -- -i ./book.txt -l B1 -m llama2 --no-modern
  npm run adapt -- --help
`);
}

/**
 * Example usage and main execution
 */
async function main() {
  const config = parseCommandLineArgs();

  console.log(`📚 Configuration:
  Input file: ${config.inputFile}
  Output file: ${config.outputFile}
  Target level: ${config.targetLevel}
  Model: ${config.model}
  Chunk size: ${config.chunkSize}
  Modern vocabulary: ${config.useModernVocabulary ? 'enabled' : 'disabled'}
`);

  // Create books directory if it doesn't exist
  const booksDir = './books';
  if (!fs.existsSync(booksDir)) {
    fs.mkdirSync(booksDir, { recursive: true });
    console.log(`📁 Created directory: ${booksDir}`);
  }

  // Check if the input file exists
  if (!fs.existsSync(config.inputFile)) {
    console.error(`❌ Input file not found: ${config.inputFile}`);
    console.error('Please make sure your book file exists.');
    process.exit(1);
  }

  try {
    const adapter = new BookAdapter(config);
    await adapter.adaptBook();
  } catch (error) {
    console.error('💥 Application failed:', error);
    process.exit(1);
  }
}

// Check if Ollama API is available
async function checkOllamaAvailability(): Promise<boolean> {
  try {
    console.log('🔍 Checking Ollama API availability...');
    const response = await fetch('http://127.0.0.1:11434/api/tags');
    console.log(`✅ Ollama API response status: ${response.status}`);
    return response.ok;
  } catch (error) {
    console.log(`❌ Ollama API check failed: ${error}`);
    return false;
  }
}

// Run the application
(async () => {
  console.log('🚀 Book Adapter for English Learners');
  console.log('=====================================\n');
  
  // Check if Ollama is available
  const ollamaAvailable = await checkOllamaAvailability();
  
  if (!ollamaAvailable) {
    console.error('⚠️  Warning: Could not connect to Ollama API.');
    console.error('   Make sure Ollama is running: ollama serve');
    console.error('   Continuing anyway - if you see connection errors, check Ollama status.');
    console.error('');
  } else {
    console.log('✅ Ollama API is available');
  }
  await main();
})().catch(console.error);
