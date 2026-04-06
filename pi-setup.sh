#!/bin/bash

# Settings
PI_MAIN_PACKAGE="@mariozechner/pi-coding-agent"
PACKAGES=(
    # Basic useful protection, imho
    "npm:@aliou/pi-guardrails"
    # Had to removeit because it can slow down startup exponentially woth big codebases, and the benefits are not worth it
    # "npm:pi-lens"
    # Very useful for preliminary scheeming and brainstorming. Also for keeping the LLM grounded over time
    "npm:@apmantza/greedysearch-pi"
    # Same as greedysearch-pi
    "npm:pi-web-access"
    # Very VERY cool porting of [LiteParse](https://www.llamaindex.ai/blog/liteparse-local-document-parsing-for-ai-agents)
    "npm:pi-docparser"
    # oh-pi needs to insstall globally running `oh-pi` command, so we must insert in the list two different type of packages: simple, and complex (custom sequences of commands)
    # Suggest avoiding this bundle, is heavy and has issues as it is...
    # "npm:@ifi/oh-pi"
    # (
    #     "pi:npm:@ifi/oh-pi"
    #     "sh:oh-pi"
    # )
    # Debatable
    "npm:@ifi/oh-pi-agents"
    # Cool but unusable for now because they made debatable design choices that cause more problems than benefits:
    # "npm:@ifi/oh-pi-ant-colony"
    # Useful but conflicts with npm:powerline-footer
    # "npm:@ifi/oh-pi-extensions"
    # Debatable
    "npm:@ifi/oh-pi-prompts"
    # Debatable
    "npm:@ifi/oh-pi-skills"
    # Debatable
    "npm:@ifi/oh-pi-themes"
    # Debatable
    "npm:@ifi/pi-extension-subagents"
    # Debatable
    "npm:@ifi/pi-plan"
    # Debatable
    "npm:@ifi/pi-spec"
    
    # Debatable
    "npm:pi-markdown-preview"

    # "npm:@guwidoe/pi-prompt-suggester"
    # REMOVED: pi-prompt-suggester has two serious drawbacks that outweigh the benefit of inline suggestions:
    #   1. SLOW STARTUP - on every session start it runs an agentic codebase seeder (up to 16 Claude API
    #      calls via claude-sonnet-4.6) to rebuild its seed.json whenever key files change. This adds
    #      several seconds of latency before the input field is even usable.
    #   2. SILENT AUTO-SUBMIT - the suggester pre-fills the input with its predicted next user message
    #      (e.g. 'detect_project'). If you hit Enter before noticing, it submits without your consent
    #      and there is no way to interrupt it once the session has started.

    # Debatable and weird to use: it creates an effimerous web server with a form to answer the interview and submit them... I'm still unsure if to keep this or not
    "npm:pi-interview"
    # Debatable, I want to have it ready if I need it, but ymmv
    "npm:pi-mermaid"
    # Debatable, but some people need it, ymmv (I don't like MCP in itself, [since even its creatores recused it](https://www.anthropic.com/engineering/code-execution-with-mcp))
    # "npm:pi-mcp-adapter"
    # Very debatable, worth a try but ymmv
    "npm:@manojlds/ralphi"
    # Eyecandy
    "npm:pi-powerline-footer"
    # Parallelization/squads tool... depends on your workflow
    # "npm:pi-messenger"
    # Useful
    "npm:pi-ask-user"
    # Useful to snoop what the tool calls are all about
    "npm:pi-tool-display"
    # In theory very powerful, still have to find a way to have my GSD workflow trigger it by itself when needed
    "npm:pi-annotate"
    # Eyecandy
    "npm:pi-animations"
    # For local-first LLM, if you need it, but I don't need it for now and it adds a dependency to ollama that I don't want
    # "npm:@0xkobold/pi-ollama"
)


# Check if pi is installed
if ! command -v pi &> /dev/null; then
    echo "pi is not installed. Installing pi..."
else
    echo "pi is already installed."
    SKIP_PI_INSTALL=true
fi

if [ "$SKIP_PI_INSTALL" = true ]; then
    echo "Skipping pi installation."
else
    echo "Installing pi..."
    # If bun use bun, else try to use pnpm, else try to use npm, else fail
    if command -v bun &> /dev/null; then
        PACKAGE_MANAGER="bun"
    elif command -v pnpm &> /dev/null; then
        PACKAGE_MANAGER="pnpm"
    elif command -v npm &> /dev/null; then
        PACKAGE_MANAGER="npm"
    else
        echo "No package manager found. Please install bun, pnpm, or npm."
        exit 1
    fi

    # install pi
    if [ "$PACKAGE_MANAGER" = "bun" ]; then
        bun a -g $PI_MAIN_PACKAGE
    elif [ "$PACKAGE_MANAGER" = "pnpm" ]; then
        pnpm a -g $PI_MAIN_PACKAGE
    elif [ "$PACKAGE_MANAGER" = "npm" ]; then
        npm i -g $PI_MAIN_PACKAGE
    fi

    # ensure pi is installed
    if ! command -v pi &> /dev/null; then
        echo "Failed to install pi. Please check the installation and try again."
        exit 1
    else
        echo "Successfully installed pi."
    fi
fi

# Capture a list of currently installed pi packages
echo "Currently installed pi packages:"
pi list

# TODO: implement a way to capture the list of current packages to eventually ask user if they want to prune packages that are not in the list of packages to install

FAILED_INSTALLS=()
SUCCESSFUL_INSTALLS=()
# add pi packages (check for each if installation is successful, if not print a warning)
# iterate over the packages and install them
for PACKAGE in "${PACKAGES[@]}"; do
    # if package is just a string, install it directly, if it's an array, execute the commands in sequence
    if [[ "$PACKAGE" == "("*")" ]]; then
        # it's an array, execute the commands in sequence
        for CMD in "${PACKAGE[@]}"; do
            CMD_PREFIX="${CMD%%:*}"
            if [[ "$CMD_PREFIX" == "pi" ]]; then
                PI_PACKAGE="${CMD#pi:}"
                echo "Installing pi package: $PI_PACKAGE"
                pi install $PI_PACKAGE
                if [ $? -ne 0 ]; then
                    echo "Warning: Failed to install $PI_PACKAGE"
                    FAILED_INSTALLS+=("(cmd:$CMD_PREFIX)$PI_PACKAGE")
                    echo "Interrupting commands sequence due to failure."
                    break
                else
                    SUCCESSFUL_INSTALLS+=("(cmd:$CMD_PREFIX)$PI_PACKAGE")
                fi
            elif [[ "$CMD_PREFIX" == "sh" ]]; then
                SH_CMD="${CMD#sh:}"
                echo "Executing shell command: $SH_CMD"
                eval "$SH_CMD"
                if [ $? -ne 0 ]; then
                    echo "Warning: Failed to execute shell command: $SH_CMD"
                    FAILED_INSTALLS+=("(cmd:$CMD_PREFIX)$SH_CMD")
                    echo "Interrupting commands sequence due to failure."
                    break
                else
                    SUCCESSFUL_INSTALLS+=("(cmd:$CMD_PREFIX)$SH_CMD")
                fi
            else
                echo "Unknown command prefix: $CMD_PREFIX"
                FAILED_INSTALLS+=("(cmd:unknown)$CMD")
            fi
        done
    else
        # it's a simple package, install it directly
        echo "Installing pi package: $PACKAGE"
        pi install $PACKAGE
        if [ $? -ne 0 ]; then
            echo "Warning: Failed to install $PACKAGE"
            FAILED_INSTALLS+=("$PACKAGE")
        else
            SUCCESSFUL_INSTALLS+=("$PACKAGE")
        fi
    fi
done

# print summary of installations
echo "Installation summary:"
echo "Successfully installed packages:"
for PACKAGE in "${SUCCESSFUL_INSTALLS[@]}"; do
    echo "- $PACKAGE"
done
echo "---"
if [ ${#FAILED_INSTALLS[@]} -ne 0 ]; then
    echo "Failed to install packages:"
    for PACKAGE in "${FAILED_INSTALLS[@]}"; do
        echo "- $PACKAGE"
    done
else
    echo "All packages installed successfully."
fi