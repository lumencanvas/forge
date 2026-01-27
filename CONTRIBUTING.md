# Contributing to SILO

Thank you for your interest in contributing to SILO! This document provides guidelines for contributing.

## Code of Conduct

Be respectful, inclusive, and constructive. We're building tools for activists and creatives - let's embody those values.

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- Git
- Ollama (for testing)

### Development Setup

```bash
# Fork the repository on GitHub

# Clone your fork
git clone https://github.com/YOUR-USERNAME/silo.git
cd silo

# Install dependencies
npm install

# Start development server
npm run dev
```

### Project Structure

```
silo/
├── electron/           # Electron main process
│   ├── main/          # Main process code
│   └── preload/       # Preload scripts
├── src/               # Vue renderer process
│   ├── assets/        # CSS, fonts, images
│   ├── components/    # Vue components
│   ├── composables/   # Vue composables
│   ├── lib/           # Utility libraries
│   └── stores/        # Pinia stores
├── docs/              # Documentation
└── tests/             # Test files (coming soon)
```

## Development Workflow

### Branches

- `main` - Stable release
- `develop` - Integration branch
- `feature/*` - New features
- `fix/*` - Bug fixes
- `docs/*` - Documentation

### Making Changes

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes

3. Run type checks:
   ```bash
   npm run typecheck
   ```

4. Commit with a clear message:
   ```bash
   git commit -m "feat: add new pipeline builder option"
   ```

5. Push and create a pull request

### Commit Messages

Follow conventional commits:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Formatting, no code change
- `refactor:` Code restructuring
- `test:` Adding tests
- `chore:` Maintenance

## Coding Standards

### TypeScript

- Use strict TypeScript
- Define interfaces for all data structures
- Avoid `any` - use `unknown` if needed
- Export types alongside functions

### Vue Components

- Use `<script setup lang="ts">`
- Use composition API
- Keep components focused and small
- Use props/emits for communication

### CSS

- Use CSS custom properties from the design system
- Follow BEM-ish naming: `.component-name`, `.component-name__element`
- No inline styles
- No emojis - use icon identifiers

### File Naming

- Components: `PascalCase.vue`
- Composables: `useCamelCase.ts`
- Utilities: `camelCase.ts`
- Stores: `camelCase.ts`

## Areas to Contribute

### Good First Issues

- Documentation improvements
- UI/UX refinements
- Bug fixes
- Test coverage

### Feature Development

- New built-in pipelines
- Pipeline builder improvements
- Accessibility enhancements
- Performance optimizations

### Infrastructure

- CI/CD improvements
- Build system updates
- Testing framework setup

## Design Guidelines

### Visual Design

SILO uses a brutalist industrial design:

- **Colors**: Dark backgrounds, orange accent
- **Typography**: Monospace primary (JetBrains Mono)
- **Spacing**: 4px base grid
- **Borders**: Sharp edges, no rounded corners
- **Icons**: Text-based or minimal SVG (NO EMOJIS)

### UX Principles

1. **Privacy First**: No external calls, local everything
2. **Transparency**: Show what's happening
3. **Simplicity**: Progressive disclosure of complexity
4. **Accessibility**: Keyboard navigation, screen reader support

## Testing

### Manual Testing

1. Test on different hardware tiers
2. Test with various Ollama models
3. Test edge cases (no models, no Ollama, etc.)

### Automated Testing (Coming Soon)

```bash
npm run test        # Unit tests
npm run test:e2e    # End-to-end tests
```

## Pull Request Process

1. **Title**: Clear, descriptive (e.g., "Add pipeline export button")
2. **Description**: What, why, and how
3. **Screenshots**: For UI changes
4. **Testing**: Describe how you tested
5. **Breaking Changes**: Call them out explicitly

### Review Checklist

- [ ] Code follows style guidelines
- [ ] TypeScript has no errors
- [ ] No console.log statements (use proper logging)
- [ ] No hardcoded values
- [ ] Accessible (keyboard, screen reader)
- [ ] Responsive (different window sizes)

## Releasing

Maintainers handle releases:

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Tag release: `git tag v1.2.3`
4. Build: `npm run build:mac && npm run build:win && npm run build:linux`
5. Create GitHub release with binaries

## Getting Help

- **Issues**: For bugs and feature requests
- **Discussions**: For questions and ideas
- **Discord**: (coming soon)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for helping make SILO better!
