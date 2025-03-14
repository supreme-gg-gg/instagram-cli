# Contributing to instagram-cli

Thank you for contributing to instagram-cli, and welcome to the force against brainrot!

## How to Contribute

### 1. Create an Issue

Before working on any changes, **you must first create an issue** in the [Issues](../../issues) section. Your issue should fall into one of these categories:

- **Bug Report** – If you've found a bug, please provide clear steps to reproduce it.
- **Feature Request** – If you have an idea for a new feature, describe its purpose and how it improves the project.

> [!IMPORTANT]
> Please clearly indicate that you are working on the issue by commenting or assigning yourself to it. Otherwise, we assume the issue is up for grabs or will be worked on by maintainers.

### 2. Fork the Repository

Fork this repository to your own GitHub account and clone it locally:

```
git clone https://github.com/supreme-gg-gg/instagram-cli.git
cd instagram-cli
```

### 3. Create a Feature Branch

Create a new branch based on the issue you’re working on:

```
git checkout -b fix-bug-123  # For bug fixes
git checkout -b feature-new-command  # For new features
```

### 4. Make Your Changes

- We prefer object-oriented programming (OOP) paradigm over functional and procedural programming.
- Type annotations (from `typing`) and docstrings are required for all functions and methods.
- Test your changes before submitting. For UI changes, provide screenshots or GIFs. For backend changes, we do not have unit tests (for now) but make sure your changes work as expected and handle edge cases.
- During development, we commend using a secondary Instagram account if you are making a lot of API calls to avoid appearing suspicious to Instagram.

### 5. Submit a Pull Request (PR)

Once you're done with your changes:

1. Push your branch to your forked repository: `git push origin feature-new-command`
2. Open a Pull Request (PR) against the `main` branch of this repository.
3. In your PR description, mention the issue number it resolves (e.g., `Closes #123`).
4. Wait for review and respond to any feedback.

### 6. Code Review & Merging

- Your PR will be reviewed, and maintainers may request changes.
- **Bug fix PRs** may be merged into `main` directly after review.
- **Feature PRs** will be collected under the **UEP (UI/UX Enhancement Patch) or IEP (Instagram Enhancement Proposal) PR** and merged together in bulk to `main`.

### 7. Semantic Versioning

- Bug fixes will increment the patch version (e.g., `1.0.1`).
- New features will increment the minor version (e.g., `1.1.0`).
- Breaking changes will increment the major version (e.g., `2.0.0`).

In our language, we use the term **UEP** for minor version changes and **IEP** for major version changes (because it sounds fancy).

## Code of Conduct

Be respectful to others in the community. Follow GitHub’s [Community Guidelines](https://docs.github.com/en/site-policy/github-terms/github-community-guidelines).

## License

By contributing, you agree that your contributions will be licensed under the same license as this project.

---

Happy coding! 🚀 Thanks for contributing!
