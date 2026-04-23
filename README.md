# GingerView

GingerView - A modern web application powered by [`SvelteKit`](https://svelte.dev/docs/kit).

## Color Palette

GingerView uses a consistent color palette throughout the application:

| Color | Hex Code | Usage |
|-------|----------|-------|
| **Bianco** | `#FFFFFF` | Backgrounds, cards, text highlights |
| **Sfondo** | `#F5F5F5` | Main application background, secondary backgrounds |
| **Grigio** | `#C8C8C8` | Borders, separators, muted text |
| **RossoGinger** | `#D72E28` | Primary actions, accents, error states |
| **Nero** | `#111111` | Primary text, headings, important content |

### Implementation

The color palette is centrally configured in `tailwind.config.cjs` and applied throughout the application using:

- **Tailwind CSS classes** for consistent styling
- **CSS custom properties** in `src/app.css` for global styles
- **Component-specific styles** that reference the palette colors

### Usage Examples

```html
<!-- Primary button with RossoGinger -->
<button class="bg-redGinger text-white hover:bg-red-700">
  Primary Action
</button>

<!-- Card with Bianco background -->
<div class="bg-white border-gray">
  Card content
</div>

<!-- Text with Nero color -->
<p class="text-black">Main text content</p>
```

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
npx sv create --template minimal --types ts --add eslint prettier --install npm GingerView
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
