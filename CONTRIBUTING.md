# Contributing to instagram-cli

Thank you for contributing to instagram-cli, and welcome to the force against brainrot!

## Project Structure

This repository contains **two separate clients** for Instagram:

- **TypeScript Client** (`./source` folder in root)
- **Python Client** (`instagram-py/` folder)

Choose the client you want to work on based on your preferences and the feature you're implementing.

The team is primarily focused on actively developing the TypeScript client. However, both clients are maintained actively.

## How to Contribute

> If you are experienced in contributing to open-source projects, jump ahead to [DEVELOPMENT.md](./DEVELOPMENT.md) for setup and code contribution instructions.

### 1. Create an Issue

Before working on any changes, **you must first create an issue** in the [Issues](../../issues) section so that everyone is informed and you can receive feedback from others in the community and maintainers. Your issue should fall into one of these categories:

- **Bug Report** – If you've found a bug, please provide clear steps to reproduce it.
- **Feature Request** – If you have an idea for a new feature, describe its purpose and how it improves the project.

> [!IMPORTANT]
> Please clearly indicate that you are working on the issue by commenting or assigning yourself to it. Otherwise, we assume the issue is up for grabs or will be worked on by maintainers.

### 2. Fork the Repository

Fork this repository to your own GitHub account and clone it locally:

```bash
git clone https://github.com/<your-username>/instagram-cli.git
cd instagram-cli
```

Add the original repository as an upstream remote:

```bash
git remote add upstream https://github.com/supreme-gg-gg/instagram-cli.git
```

### 3. Create a Feature Branch

Create a new branch based on the issue you’re working on:

```bash
git checkout -b fix-bug-123  # For bug fixes
git checkout -b feature-new-command  # For new features
```

### 4. Make Your Changes

Setup the development environment as per the instructions in [DEVELOPMENT.md](./DEVELOPMENT.md). More guidelines for contributing code are included there as well.

Test your changes before submitting. _For UI changes, provide screenshots or GIFs._

> [!TIP]
> During development, we recommend using a secondary Instagram account if you are making a lot of API calls to avoid appearing suspicious to Instagram. Alternatively, use our mock data for UI changes.

### 5. Submit a Pull Request (PR)

Once you're done with your changes:

0. Update with latest main branch: `git fetch upstream && git rebase upstream/main`
1. Push your branch to your forked repository: `git push origin feature-new-command`
2. Open a Pull Request (PR) against the `main` branch of this repository.
3. In your PR description, mention the issue number it resolves (e.g., `Closes #123`).
4. Wait for review and respond to any feedback.

### 6. Code Review & Merging

- Your PR will be reviewed, and maintainers may request changes.

### 7. Releases and Versioning

You don't need to worry about changing version numbers; maintainers will handle that during the release process.

Releases are created manually through GitHub's release page. We use different tag conventions for each client:

- **Python Client**: Use `v1.4.2`, `v1.5.0`, etc.
- **TypeScript Client**: Use `ts-v1.0.0`, `ts-v1.1.0-beta`, etc.

**Semantic Versioning:**

- Bug fixes increment the patch version (e.g., `1.0.1`)
- New features increment the minor version (e.g., `1.1.0`)
- Breaking changes increment the major version (e.g., `2.0.0`)

## Code of Conduct

Be respectful to others in the community. Follow GitHub’s [Community Guidelines](https://docs.github.com/en/site-policy/github-terms/github-community-guidelines).

## License

By contributing, you agree that your contributions will be licensed under the same license as this project.

---

Happy coding! 🚀 Thanks for contributing!
