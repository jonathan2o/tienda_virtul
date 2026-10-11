#!/usr/bin/env bash
#
# Diagnosticador General de Estado — "Todo en uno"
# Techno Shop / tienda_virtul
#
# Muestra de un vistazo: Nginx + Backend Gunicorn (systemd) + PostgreSQL
# (docker tienda_virtual_postgres) + disco/memoria/CPU.
#
# Uso en VPS:
#   chmod +x scripts/health-check.sh
#   bash scripts/health-check.sh
#   # Solo fallos:
#   bash scripts/health-check.sh 2>&1 | grep -i -A2 "FAIL\|ERROR\|inactive\|down"
#
# Variables configurables (env o flags):
#   BACKEND_SERVICE=gunicorn DB_CONTAINER=tienda_virtual_postgres \
#   BACKEND_URL=http://127.0.0.1:8001/api/ bash scripts/health-check.sh
#
# Solo lectura: no reinicia ni modifica nada. Exit 0 = todo OK, 1 = algo falla.
# Compatible con Ubuntu/Debian con systemd. Degrada con gracia sin sudo/docker.

set -u

BACKEND_SERVICE="${BACKEND_SERVICE:-gunicorn}"
DB_CONTAINER="${DB_CONTAINER:-tienda_virtual_postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:8001/api/}"
FRONTEND_URL="${FRONTEND_URL:-http://127.0.0.1/}"

# Flags simples: --backend-service NAME --db-container NAME --backend-url URL
while [[ $# -gt 0 ]]; do
  case "$1" in
    --backend-service) BACKEND_SERVICE="${2:-$BACKEND_SERVICE}"; shift 2 ;;
    --db-container) DB_CONTAINER="${2:-$DB_CONTAINER}"; shift 2 ;;
    --backend-url) BACKEND_URL="${2:-$BACKEND_URL}"; shift 2 ;;
    -h|--help)
      echo "Uso: $0 [--backend-service NAME] [--db-container NAME] [--backend-url URL]"
      echo "Env: BACKEND_SERVICE DB_CONTAINER DB_HOST DB_PORT BACKEND_URL FRONTEND_URL"
      exit 0 ;;
    *) echo "Flag desconocida: $1 (usa --help)" >&2; exit 2 ;;
  esac
done

# ---- helpers ----
if [[ -t 1 ]]; then
  C_RESET='\033[0m'; C_TITLE='\033[1;36m'; C_OK='\033[1;32m'; C_FAIL='\033[1;31m'; C_WARN='\033[1;33m'
else
  C_RESET=''; C_TITLE=''; C_OK=''; C_FAIL=''; C_WARN=''
fi

PASS=0; FAIL=0
declare -a RESULTS=()

have() { command -v "$1" >/dev/null 2>&1; }

title() { echo -e "\n${C_TITLE}===== $1 =====${C_RESET}"; }
ok()   { echo -e "${C_OK}[OK]${C_RESET} $1"; PASS=$((PASS+1)); RESULTS+=("OK   | $1"); }
fail() { echo -e "${C_FAIL}[FAIL]${C_RESET} $1"; FAIL=$((FAIL+1)); RESULTS+=("FAIL | $1"); }
warn() { echo -e "${C_WARN}[WARN]${C_RESET} $1"; RESULTS+=("WARN | $1"); }
info() { echo "  $1"; }

safe_run() { # safe_run "descripcion" comando...
  local desc="$1"; shift
  if "$@" >/dev/null 2>&1; then ok "$desc"; return 0
  else fail "$desc"; return 1; fi
}

echo -e "${C_TITLE}Diagnosticador General — $(date -u '+%Y-%m-%d %H:%M:%S UTC') — host: $(hostname 2>/dev/null || echo '?')${C_RESET}"
echo "Config: backend_service=$BACKEND_SERVICE db_container=$DB_CONTAINER db=$DB_HOST:$DB_PORT backend_url=$BACKEND_URL"

# ================= 1. SISTEMA =================
title "1) SISTEMA"
info "Fecha: $(date 2>/dev/null || echo '?')"
if have uptime; then info "Uptime: $(uptime 2>/dev/null || echo '?')"
else warn "sin comando 'uptime'"; fi
if have nproc; then info "CPUs: $(nproc 2>/dev/null)"; fi
if [[ -r /proc/loadavg ]]; then info "Load: $(cat /proc/loadavg)"; fi

# ================= 2. NGINX =================
title "2) NGINX"
if have systemctl; then
  if systemctl is-active --quiet nginx 2>/dev/null; then ok "nginx service activo (systemd)"
  else fail "nginx service NO activo (systemctl is-active nginx != active)"; fi
  info "--- systemctl status nginx (5 lineas) ---"
  systemctl status nginx --no-pager -l 2>&1 | head -n 12 | sed 's/^/  /' || warn "no se pudo leer status de nginx"
else
  warn "sin systemctl; salto chequeo systemd de nginx"
fi

if have nginx; then
  if nginx -t 2>&1 | sed 's/^/  /'; then ok "nginx -t: sintaxis OK"
  else fail "nginx -t: error de sintaxis (ver arriba)"; fi
else
  warn "binario 'nginx' no en PATH (normal si se revisa sin sudo)"
fi

# Puertos 80/443
if have ss; then
  info "--- ss -tlnp (80/443) ---"
  ss -tlnp 2>/dev/null | grep -E ':80 |:443 ' | sed 's/^/  /' || fail "nada escuchando en :80 ni :443"
  ss -tlnp 2>/dev/null | grep -Eq ':80 |:443 ' && ok "puerto 80/443 en escucha" || true
elif have netstat; then
  netstat -tlnp 2>/dev/null | grep -E ':80 |:443 ' | sed 's/^/  /' || fail "nada escuchando en :80 ni :443"
else
  warn "sin 'ss' ni 'netstat' para verificar puertos"
fi

# Respuesta HTTP local (no sigue redirects, timeout 5s)
if have curl; then
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -m 5 -I "$FRONTEND_URL" 2>/dev/null || echo "000")
  info "curl -I $FRONTEND_URL -> HTTP $CODE"
  case "$CODE" in
    200|301|302) ok "Nginx responde HTTP $CODE" ;;
    *) fail "Nginx no responde OK (HTTP $CODE)" ;;
  esac
else
  warn "sin 'curl'; salto chequeo HTTP de Nginx"
fi

# ================= 3. BACKEND GUNICORN =================
title "3) BACKEND ($BACKEND_SERVICE)"
if have systemctl; then
  if systemctl is-active --quiet "$BACKEND_SERVICE" 2>/dev/null; then ok "$BACKEND_SERVICE activo (systemd)"
  else
    fail "$BACKEND_SERVICE NO activo"
    # Sugerir units parecidas para encontrar el nombre real
    info "Units parecidas:"
    systemctl list-units --type=service --all 2>/dev/null | grep -i -E 'gunicorn|django|tienda|backend' | sed 's/^/  /' || info "  (ninguna coincidencia)"
  fi
  info "--- systemctl status $BACKEND_SERVICE (12 lineas) ---"
  systemctl status "$BACKEND_SERVICE" --no-pager -l 2>&1 | head -n 12 | sed 's/^/  /' || true
else
  warn "sin systemctl; salto chequeo systemd del backend"
fi

# Proceso gunicorn vivo aunque systemd falle
if have pgrep; then
  if pgrep -af "gunicorn" 2>/dev/null | sed 's/^/  /' | grep -q gunicorn; then
    pgrep -af "gunicorn" | sed 's/^/  /'
    ok "proceso gunicorn en ejecucion"
  else fail "no hay proceso gunicorn (pgrep vacio)"; fi
elif have ps; then
  if ps aux 2>/dev/null | grep -i "[g]unicorn" | sed 's/^/  /' | grep -q .; then
    ps aux | grep -i "[g]unicorn" | sed 's/^/  /'
    ok "proceso gunicorn en ejecucion"
  else fail "no hay proceso gunicorn (ps vacio)"; fi
else
  warn "sin pgrep/ps"
fi

# Salud HTTP del API
if have curl; then
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -m 5 "$BACKEND_URL" 2>/dev/null || echo "000")
  info "curl $BACKEND_URL -> HTTP $CODE"
  # DRF sin auth suele dar 401/403/301/200 segun endpoint; 000/500/502 = caida
  case "$CODE" in
    200|301|302|401|403|405) ok "Backend responde HTTP $CODE (proceso vivo)" ;;
    000) fail "Backend inalcanzable (conexion rechazada/timeout). ¿Gunicorn caido o puerto distinto de 8001?" ;;
    502|503|500) fail "Backend responde HTTP $CODE (error/proxy). Revisa journalctl abajo" ;;
    *) fail "Backend responde HTTP $CODE inesperado" ;;
  esac
fi

# Ultimos errores del servicio
if have journalctl; then
  info "--- journalctl -u $BACKEND_SERVICE errores 15min (10 lineas) ---"
  journalctl -u "$BACKEND_SERVICE" --since "-15 min" -p err --no-pager 2>&1 | tail -n 10 | sed 's/^/  /' || warn "sin acceso a journalctl (prueba con sudo)"
else
  warn "sin journalctl"
fi

# ================= 4. BASE DE DATOS POSTGRES =================
title "4) BASE DE DATOS (docker $DB_CONTAINER @ $DB_HOST:$DB_PORT)"
if have docker; then
  info "--- docker ps (filtro $DB_CONTAINER) ---"
  if docker ps --filter "name=$DB_CONTAINER" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>&1 | sed 's/^/  /' | grep -q "$DB_CONTAINER"; then
    docker ps --filter "name=$DB_CONTAINER" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | sed 's/^/  /'
    ok "contenedor $DB_CONTAINER corriendo"
  else
    fail "contenedor $DB_CONTAINER NO corriendo"
    info "Contenedores existentes:"
    docker ps -a --format "table {{.Names}}\t{{.Status}}" 2>&1 | head -n 10 | sed 's/^/  /' || true
  fi
else
  warn "sin 'docker' en PATH; salto chequeo de contenedor (verifica pg_isready abajo)"
fi

# pg_isready: binario local o dentro del contenedor
if have pg_isready; then
  if pg_isready -h "$DB_HOST" -p "$DB_PORT" 2>&1 | sed 's/^/  /'; then
    if pg_isready -h "$DB_HOST" -p "$DB_PORT" >/dev/null 2>&1; then ok "Postgres acepta conexiones ($DB_HOST:$DB_PORT)"
    else fail "pg_isready reporta rechazo en $DB_HOST:$DB_PORT"; fi
  else
    fail "pg_isready no pudo conectar a $DB_HOST:$DB_PORT"
  fi
elif have docker; then
  if docker exec "$DB_CONTAINER" pg_isready -U postgres 2>&1 | sed 's/^/  /'; then ok "Postgres OK via docker exec pg_isready"
  else fail "Postgres NO responde via docker exec pg_isready"; fi
else
  warn "sin pg_isready ni docker; no se pudo probar la DB"
fi

# Query ligera SELECT 1 si hay psql o docker exec
if have psql; then
  if PGPASSWORD="${PGPASSWORD:-}" psql -h "$DB_HOST" -p "$DB_PORT" -U "${PGUSER:-postgres}" -d postgres -c "SELECT 1;" 2>&1 | sed 's/^/  /' | grep -q "1 row"; then
    ok "psql SELECT 1 exitoso"
  else
    warn "psql SELECT 1 fallo (puede ser credenciales; pg_isready manda). Prueba manual: PGPASSWORD=*** psql -h $DB_HOST -U <user> -d tienda_virtual_db -c 'SELECT 1;'"
  fi
elif have docker; then
  if docker exec "$DB_CONTAINER" psql -U postgres -d postgres -c "SELECT 1;" 2>&1 | grep -q "1 row"; then ok "SELECT 1 exitoso via docker exec"
  else warn "SELECT 1 via docker exec fallo (revisar logs: docker logs --tail 30 $DB_CONTAINER)"; fi
fi

if have docker; then
  info "--- docker logs --tail 15 $DB_CONTAINER (errores) ---"
  docker logs --tail 15 "$DB_CONTAINER" 2>&1 | tail -n 15 | sed 's/^/  /' || warn "sin acceso a docker logs"
fi

# ================= 5. RECURSOS =================
title "5) RECURSOS (disco/memoria/CPU)"
if have df; then
  info "--- df -h / y /var ---"
  df -h / /var 2>/dev/null | sed 's/^/  /'
  USE_ROOT=$(df / 2>/dev/null | awk 'NR==2{gsub(/%/,"",$5); print $5}')
  if [[ "${USE_ROOT:-0}" =~ ^[0-9]+$ ]]; then
    if (( USE_ROOT >= 90 )); then fail "disco / al ${USE_ROOT}% (>=90% critico)"
    elif (( USE_ROOT >= 80 )); then warn "disco / al ${USE_ROOT}% (>=80% alerta)"
    else ok "disco / al ${USE_ROOT}%"; fi
  fi
fi
if have free; then
  info "--- free -h ---"
  free -h 2>&1 | sed 's/^/  /'
  # Alerta si poca memoria disponible (<500MB)
  if free -m 2>/dev/null | awk '/^Mem:/{exit !($7 < 500)}'; then warn "memoria disponible <500MB"; else ok "memoria disponible suficiente"; fi
fi
if [[ -r /proc/loadavg ]]; then info "Load: $(cat /proc/loadavg)"; fi
if have vmstat; then info "--- vmstat 1 2 (ultima muestra) ---"; vmstat 1 2 2>/dev/null | tail -n 3 | sed 's/^/  /' || true; fi

# Tamanos sospechosos del proyecto (rutas relativas al CWD y absolutas tipicas)
info "--- tamano de media/logs (si existen) ---"
for d in ./tienda_virtual/media ./media /opt/tienda_virtul/tienda_virtual/media /var/log/nginx /var/log; do
  [[ -e "$d" ]] && du -sh "$d" 2>/dev/null | sed 's/^/  /' || true
done

# ================= 6. RESUMEN =================
title "6) RESUMEN"
for r in "${RESULTS[@]}"; do echo "  $r"; done
echo ""
echo -e "Checks OK: ${C_OK}$PASS${C_RESET} | Fallos: ${C_FAIL}$FAIL${C_RESET}"
if (( FAIL == 0 )); then
  echo -e "${C_OK}TODO OK — sistema saludable${C_RESET}"
  exit 0
else
  echo -e "${C_FAIL}HAY $FAIL FALLO(S) — orden sugerido: 1) systemctl status <svc> 2) journalctl -u $BACKEND_SERVICE --since '-30 min' 3) nginx -t 4) docker logs $DB_CONTAINER${C_RESET}"
  exit 1
fi
