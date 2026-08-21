# FreeRADIUS v3 (alpine) — server RADIUS untuk MicroRAD PPPoE Manager
# Driver postgresql ter-install (freeradius-postgresql); config overlay di /etc/raddb.
# Port: 1812/udp (auth) + 1813/udp (accounting)
FROM alpine:3.21

RUN apk add --no-cache freeradius freeradius-postgresql freeradius-utils bash

# Overlay config raddb:
#  - mods-enabled/sql   -> file penuh (bukan symlink), read_clients=yes,
#                          kredensial DB di-templating entrypoint.sh
#  - clients.conf       -> localhost + subnet docker (secret testing123)
#  - entrypoint.sh      -> tunggu postgres, templating, radiusd -f
COPY mods-enabled/sql /etc/raddb/mods-enabled/sql
COPY clients.conf /etc/raddb/clients.conf
# Listen CoA/Disconnect (port 3799) — append ke radiusd.conf
COPY listen-coa.conf /etc/raddb/listen-coa.conf
RUN cat /etc/raddb/listen-coa.conf >> /etc/raddb/radiusd.conf

# Aktifkan modul sql: ganti "-sql" (disabled) -> "sql" di authorize,
# accounting, post-auth (+ Post-Auth-Type REJECT). Bagian session sudah `sql`.
RUN sed -i -E 's/^\s*-sql\s*$/\tsql/' /etc/raddb/sites-enabled/default \
 && sed -i -E 's/^\s*-sql\s*$/\tsql/' /etc/raddb/sites-enabled/inner-tunnel

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 1812/udp 1813/udp 3799/udp
ENTRYPOINT ["/entrypoint.sh"]