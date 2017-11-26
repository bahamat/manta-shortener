#!/bin/bash

set -o errexit

if [[ -n "$TRACE" ]]; then
    export PS4='[\D{%FT%TZ}] ${BASH_SOURCE}:${LINENO}: ${FUNCNAME[0]:+${FUNCNAME[0]}(): }'
    set -o xtrace
fi

usage() {
    printf '%s -l login -e email -P triton-profile -d manta_directory [ -p password ]\n' "$0"
    printf '\t-l login\tsub-user login name\n'
    printf '\t-e email\tsub-user email address\n'
    printf '\t-P profile\tnode-triton profile name (default is env)\n'
    printf '\t-d directory\tmanta directory for persistent storage\n'
    printf '\t-p password\tsub-user password (random if empty)\n'
    exit "$1"
}
while getopts 'l:e:p:p:d:h' options; do
    case $options in
        l ) login="${OPTARG}";;
        e ) email="${OPTARG}";;
        P ) profile=('-p' "${OPTARG}");;
        p ) password="${OPTARG}";;
        d ) directory="${OPTARG}";;
        h ) usage 0;;
        * ) usage 1;;
    esac
done

# Hack to check vars
printf '%s' "${login:?} ${email:?} ${directory:?}" >/dev/null

if [[ -z $password ]]; then
    password=$(openssl rand -hex 16)
fi
user_json=$(printf '{"login":"%s","email":"%s","password":"%s"}' "$login" "$email" "$password")
role_json=$(printf '{"name":"manta_shortener","members":["%s"],"policies":["manta_shortener"]}' "$login")

policy_json='{"name":"manta_shortener","rules":["CAN getdirectory","CAN getobject","CAN putdirectory","CAN putobject"]}'

triton "${profile[@]}" cloudapi /my/users -X POST -d "$user_json"
triton "${profile[@]}" cloudapi /my/policies -X POST -d "$policy_json"
triton "${profile[@]}" cloudapi /my/roles -X POST -d "$role_json"

mmkdir "$directory"
mchmod +manta_shortener "$directory"
