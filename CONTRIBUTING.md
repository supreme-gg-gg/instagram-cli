# Contributing to instagram-cli

Thank you for contributing to instagram-cli, and welcome to the force against brainrot!

## Getting Started

> [!NOTE]
> This only applies to the Python client. Please refer to the README file for the `ts-migration/main` branch instead for the TypeScript client.

To get started, clone the repository to your local machine:

```bash
git clone https://github.com/supreme-gg-gg/instagram-cli.git
cd instagram-cli
```

Create a virtual environment to isolate your dependencies:

```bash
python -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`
```

To create a development build, you can use the following command:

```bash
pip install -e .
```

To configure the pre-commit hooks for both Python and TypeScript, run:

```bash
pip install pre-commit
pre-commit install
```

Now when you commit it checks any changes in both Python and TypeScript files and formats/lints them automatically using the respective linters.

If you do not want to use pre-commit hooks, at the very least, run the following commands manually to ensure code quality:

```bash
pip install ruff
ruff check .
ruff format .
```

## How to Contribute

> If you are experienced in contributing to open-source projects, you only need to go over sections 1 and 4.

### 1. Create an Issue

Before working on any changes, **you must first create an issue** in the [Issues](../../issues) section so that everyone is informed and you can receive feedback from others in the community and maintainers. Your issue should fall into one of these categories:

- **Bug Report** – If you've found a bug, please provide clear steps to reproduce it.
- **Feature Request** – If you have an idea for a new feature, describe its purpose and how it improves the project.

> [!IMPORTANT]
> Please clearly indicate that you are working on the issue by commenting or assigning yourself to it. Otherwise, we assume the issue is up for grabs or will be worked on by maintainers.

### 2. Fork the Repository

Fork this repository to your own GitHub account and clone it locally:

```bash
git clone https://github.com/supreme-gg-gg/instagram-cli.git
cd instagram-cli
```

### 3. Create a Feature Branch

Create a new branch based on the issue you’re working on:

```bash
git checkout -b fix-bug-123  # For bug fixes
git checkout -b feature-new-command  # For new features
```

### 4. Make Your Changes

- Type annotations (from `typing`) and docstrings are required for all functions and methods.
- We prefer object-oriented programming (OOP) paradigm over functional and procedural programming.
- Test your changes before submitting. _For UI changes, provide screenshots or GIFs._ For backend changes, we do not have unit tests (for now) but make sure your changes work as expected and handle edge cases.

> [!TIP]
> During development, we recommend using a secondary Instagram account if you are making a lot of API calls to avoid appearing suspicious to Instagram.

### 5. Code Quality Checks

For Python client, we do not have a pre-commit hook set up yet, so you will need to run the following commands manually:

```bash
ruff check .
ruff format .
```

For TypeScript client, we already have a pre-commit hook using `prettier` and `eslint`.

Code quality check action will run automatically when you submit any PR, so make sure your code passes the checks before submitting.

### 5. Submit a Pull Request (PR)

Once you're done with your changes:

1. Push your branch to your forked repository: `git push origin feature-new-command`
2. Open a Pull Request (PR) against the `main` branch of this repository.
3. In your PR description, mention the issue number it resolves (e.g., `Closes #123`).
4. Wait for review and respond to any feedback.

### 6. Code Review & Merging

- Your PR will be reviewed, and maintainers may request changes.

### 7. Semantic Versioning

- Bug fixes will increment the patch version (e.g., `1.0.1`).
- New features will increment the minor version (e.g., `1.1.0`).
- Breaking changes will increment the major version (e.g., `2.0.0`).

## Code of Conduct

Be respectful to others in the community. Follow GitHub’s [Community Guidelines](https://docs.github.com/en/site-policy/github-terms/github-community-guidelines).

## License

By contributing, you agree that your contributions will be licensed under the same license as this project.

---

Happy coding! 🚀 Thanks for contributing!
