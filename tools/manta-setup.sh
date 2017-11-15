#!/bin/bash

set -o errexit

if [[ -n "$TRACE" ]]; then
    export PS4='[\D{%FT%TZ}] ${BASH_SOURCE}:${LINENO}: ${FUNCNAME[0]:+${FUNCNAME[0]}(): }'
    set -o xtrace
fi

while getopts 'l:e:p:p:d:' options; do
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

policy_json='{"name":"manta_shortener","rules":["CANgetdirectory","CANgetobject","CANputdirectory","CANputobject"]}'

triton "${profile[@]}" rbac user --add <(printf '%s' "$user_json")
triton "${profile[@]}" rbac policy add <(printf '%s' "$policy_json")
triton "${profile[@]}" rbac role add <(printf '%s' "$role_json")

mmkdir "$directory"
mchmod +manta_shortener "$directory"
