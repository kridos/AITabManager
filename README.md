# AI Tab Session Manager

A powerful browser extension that saves your tab sessions with AI-generated context descriptions and enables semantic search across saved sessions. Never lose track of your research sessions again!

## Features

- **Smart Session Saving**: Capture all open tabs with one click
- **AI-Generated Context**: Automatically describe what you were working on using Claude or GPT
- **Semantic Search**: Find sessions using natural language queries like "find that time I was researching sorting algorithms"
- **Session Management**: View, restore, edit, and delete saved sessions
- **Export/Import**: Backup and restore your sessions as JSON files
- **Multiple AI Providers**: Support for Anthropic Claude and OpenAI GPT models

## Installation

### For Development/Testing

1. **Clone or download this repository**
   ```bash
   git clone <repository-url>
   cd AITabManager
   ```

2. **Generate extension icons** (optional but recommended)

   The extension includes placeholder icons. To generate proper PNG icons from the SVG:
   ```bash
   # Using ImageMagick
   cd icons
   convert icon.svg -resize 16x16 icon16.png
   convert icon.svg -resize 32x32 icon32.png
   convert icon.svg -resize 48x48 icon48.png
   convert icon.svg -resize 128x128 icon128.png
   ```

3. **Load the extension in Chrome/Edge**
   - Open `chrome://extensions/` (or `edge://extensions/`)
   - Enable "Developer mode" in the top right
   - Click "Load unpacked"
   - Select the `AITabManager` directory

4. **Load the extension in Firefox**
   - Open `about:debugging#/runtime/this-firefox`
   - Click "Load Temporary Add-on"
   - Navigate to the `AITabManager` directory and select `manifest.json`

## Setup

### 1. Configure API Keys

Click the extension icon, then click the settings gear (⚙️) to configure:

#### For Anthropic Claude (Recommended for context generation)

1. Get an API key from [Anthropic Console](https://console.anthropic.com/)
2. In settings:
   - Select "Anthropic (Claude)" as AI Provider
   - Enter your API key
   - Choose model (Claude 3 Haiku for fast/cheap, Claude 3.5 Sonnet for better quality)
   - Click "Save Settings"

**Note**: Anthropic doesn't provide embeddings, so semantic search will use basic text matching.

#### For OpenAI (Enables full semantic search)

1. Get an API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. In settings:
   - Select "OpenAI (GPT)" as AI Provider
   - Enter your API key
   - Choose model (GPT-3.5 Turbo for fast/cheap, GPT-4 for better quality)
   - Click "Save Settings"

**Benefits**: OpenAI enables true semantic search using embeddings, allowing you to find sessions even when your search terms don't exactly match the tab titles.

### 2. Adjust Settings

- **Search Sensitivity**: Higher values return more results (1-10 scale)
- **Auto-generate Context**: Automatically generate AI descriptions when saving sessions

## Usage

### Saving a Session

1. Open the tabs you want to save
2. Click the extension icon
3. Click "💾 Save Current Session"
4. The session will be saved with a timestamp
5. If auto-context is enabled, AI will generate a description in the background

### Searching for Sessions

#### Basic Search (Works without API key)
1. Type keywords in the search box (e.g., "javascript tutorial")
2. Click 🔍 or press Enter
3. View matching sessions in the "Search Results" tab

#### Semantic Search (Requires OpenAI API key)
1. Type a natural language query (e.g., "when I was learning about React hooks")
2. The AI will find semantically similar sessions, even if exact words don't match
3. Results are ranked by relevance

### Restoring a Session

1. Find the session in the list or search results
2. Click the 🔄 button
3. All tabs will open in a new window

### Managing Sessions

- **View**: Click on a session to see its details
- **Delete**: Click the 🗑️ button on any session
- **Export**: Go to Settings → Data Management → Export Sessions
- **Import**: Go to Settings → Data Management → Import Sessions

## How It Works

### Context Generation

When you save a session, the extension:
1. Captures all tab URLs and titles in the current window
2. Sends them to your chosen AI provider (Claude or GPT)
3. The AI analyzes the tabs and generates a concise description
4. The description is stored with the session for easy searching

Example context: "Research session on React state management, focusing on hooks like useState and useEffect, with several tutorial articles and official documentation pages"

### Semantic Search (OpenAI only)

1. When saving sessions, AI generates vector embeddings of context descriptions
2. When searching, your query is converted to a vector embedding
3. Sessions are ranked by cosine similarity to your query
4. This allows "fuzzy" matching based on meaning, not just keywords

## Privacy & Security

- **All data stays local**: Sessions are stored in your browser's local storage
- **API keys are encrypted**: Keys are stored locally and never shared
- **No telemetry**: The extension doesn't collect or send any usage data
- **API calls**: Only made to Anthropic/OpenAI when generating contexts or searching

## Troubleshooting

### "API key not configured" error
- Go to Settings (⚙️) and add your API key
- Make sure you selected the correct provider

### Semantic search not working
- Semantic search requires an OpenAI API key
- With Anthropic, only basic text search is available
- Check browser console for error messages

### Sessions not saving
- Check browser console for errors
- Ensure you have storage permission enabled
- Try exporting and re-importing your sessions

### Icons not showing
- Generate proper PNG icons from the SVG (see Installation step 2)
- Reload the extension after generating icons

## Development

### Project Structure

```
AITabManager/
├── manifest.json           # Extension manifest
├── background/
│   └── background.js       # Service worker for background tasks
├── popup/
│   ├── popup.html         # Main popup UI
│   └── popup.js           # Popup logic
├── options/
│   ├── options.html       # Settings page UI
│   └── options.js         # Settings logic
├── scripts/
│   ├── ai-service.js      # AI API integration
│   └── storage.js         # Storage utilities
├── styles/
│   ├── popup.css          # Popup styles
│   └── options.css        # Settings page styles
└── icons/
    └── ...                # Extension icons
```

### Tech Stack

- **Manifest V3** (Chrome/Firefox compatible)
- **Vanilla JavaScript** (no frameworks)
- **Chrome Storage API** for session data
- **IndexedDB** for embedding vectors
- **Anthropic Claude API** or **OpenAI API** for AI features

### Adding Features

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly in both Chrome and Firefox
5. Submit a pull request

## API Costs

Both APIs charge based on usage:

### Anthropic Claude
- **Claude 3 Haiku**: ~$0.00025 per context generation
- **Claude 3.5 Sonnet**: ~$0.003 per context generation

### OpenAI
- **GPT-3.5 Turbo**: ~$0.0001 per context generation
- **GPT-4**: ~$0.003 per context generation
- **Embeddings**: ~$0.00001 per session (for semantic search)

Example: Saving 100 sessions with GPT-3.5 Turbo + embeddings ≈ $0.01

## License

MIT License - feel free to use and modify as needed.

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## Support

For issues, bugs, or feature requests, please open an issue on GitHub.

---

**Happy tab managing! 🚀**
