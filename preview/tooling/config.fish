# ~/.config/fish/config.fish — Godhuli Shop dev setup

set -gx GODHULI_HOME $HOME/code/godhuli-shop
set -gx EDITOR nvim
set -gx NODE_ENV development
fish_add_path $GODHULI_HOME/bin $HOME/.local/bin

if status is-interactive
    set -g fish_greeting "Welcome back to Godhuli Shop 🌅"

    abbr -a gs git status -sb
    abbr -a gco git checkout
    abbr -a dc docker compose
    abbr -a --position anywhere -- --dry '--dry-run'
end

function shop --description "Jump to the Godhuli Shop repo"
    cd $GODHULI_HOME; or return 1
    if test (count $argv) -gt 0; and test -d packages/$argv[1]
        cd packages/$argv[1]
    end
end

function deploy --argument-names env
    set -q env[1]; or set env staging
    switch $env
        case staging
            echo "Deploying to staging…"
        case 'prod*'
            read -l -P "Deploy to PRODUCTION? [y/N] " confirm
            test "$confirm" = y; or return 1
        case '*'
            echo "unknown env: $env" >&2
            return 2
    end
    $GODHULI_HOME/tooling/deploy.sh -e $env
end

function fish_prompt
    set -l last_status $status
    set -l branch (git branch --show-current 2>/dev/null)
    set_color ff8c42; echo -n (prompt_pwd)
    if test -n "$branch"
        set_color magenta; echo -n " ($branch)"
    end
    if test $last_status -ne 0
        set_color red; echo -n " [$last_status]"
    end
    set_color normal; echo -n ' ❯ '
end
