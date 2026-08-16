#!/bin/sh
# Entrypoint FreeRADIUS MicroRAD:
#   1) tunggu Postgres (max 60s)
#   2) templating kredensial DB ke mods-enabled/sql (sed — file berisi $)
#   3) radiusd -C (validasi config)
#   4) jalan foreground; RADIUS_DEBUG=1 -> radiusd -X (debug ke stderr)
set -e

POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-microrad}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-microrad}"
POSTGRES_DB="${POSTGRES_DB:-microrad}"

echo "[freeradius] menunggu postgres ${POSTGRES_HOST}:${POSTGRES_PORT} ..."
n=0
until nc -z "${POSTGRES_HOST}" "${POSTGRES_PORT}"; do
	n=$((n+1))
	if [ "$n" -gt 60 ]; then
		echo "[freeradius] postgres tidak terjangkau setelah 60s — keluar"
		exit 1
	fi
	sleep 1
done
echo "[freeradius] postgres siap."

sed -i \
	-e "s/^\(\s*server\s*=\s*\).*/\1\"${POSTGRES_HOST}\"/" \
	-e "s/^\(\s*port\s*=\s*\).*/\1${POSTGRES_PORT}/" \
	-e "s/^\(\s*login\s*=\s*\).*/\1\"${POSTGRES_USER}\"/" \
	-e "s/^\(\s*password\s*=\s*\).*/\1\"${POSTGRES_PASSWORD}\"/" \
	-e "s/^\(\s*radius_db\s*=\s*\).*/\1\"${POSTGRES_DB}\"/" \
	/etc/raddb/mods-enabled/sql

echo "[freeradius] radiusd -C (validasi config) ..."
if ! radiusd -C 2>&1 | tee /tmp/radiusd-c.out; then
	echo "[freeradius] radiusd -C GAGAL — dump /tmp/radiusd-c.out:"
	cat /tmp/radiusd-c.out
	exit 1
fi

echo "[freeradius] starting radiusd (debug=${RADIUS_DEBUG:-0})"
if [ "${RADIUS_DEBUG:-0}" = "1" ]; then
	exec radiusd -f -X
else
	exec radiusd -f
fi