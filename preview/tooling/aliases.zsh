# ~/.config/zsh/aliases.zsh — Godhuli Shop dev shell
setopt AUTO_CD EXTENDED_GLOB HIST_IGNORE_DUPS SHARE_HISTORY PROMPT_SUBST
unsetopt BEEP

autoload -Uz compinit vcs_info add-zsh-hook
compinit -d "${XDG_CACHE_HOME:-$HOME/.cache}/zcompdump"

export GODHULI_HOME="$HOME/code/godhuli-shop"
typeset -U path
path=("$GODHULI_HOME/bin" "$HOME/.local/bin" $path)

# Aliases
alias ll='ls -lAh --color=auto'
alias gs='git status -sb'
alias gl="git log --oneline --graph --decorate -n 20"
alias dc='docker compose'
alias -g G='| grep -i'
alias -s {json,yaml,yml}=code

# Jump into the project and optionally a sub-package
shop() {
  local target="${1:-}"
  cd "$GODHULI_HOME" || return 1
  [[ -n $target && -d packages/$target ]] && cd "packages/$target"
}

# Tail logs for a service with highlighted levels
shoplogs() {
  local svc=${1:?usage: shoplogs <service>}
  docker compose logs -f --tail=100 "$svc" | \
    sed -E $'s/(ERROR)/\e[31m\\1\e[0m/; s/(WARN)/\e[33m\\1\e[0m/'
}

# Count orders in a CSV export, skipping the header
count_orders() {
  for f in ${@:-*.csv}(N.); do
    print -P "%F{yellow}${f:t}%f: $(( $(wc -l < $f) - 1 )) orders"
  done
}

# Prompt with git branch
zstyle ':vcs_info:git:*' formats ' %F{magenta}(%b)%f'
add-zsh-hook precmd vcs_info
PROMPT='%F{208}%n@godhuli%f %F{cyan}%~%f${vcs_info_msg_0_} %(?.%F{green}.%F{red})❯%f '
RPROMPT='%F{240}%*%f'

bindkey -e
bindkey '^[[A' history-search-backward
