#!/bin/bash
set -e

# Create multiple databases if specified in POSTGRES_MULTIPLE_DATABASES
if [ -n "$POSTGRES_MULTIPLE_DATABASES" ]; then
	echo "Multiple database creation requested: $POSTGRES_MULTIPLE_DATABASES"
	for db in $(echo $POSTGRES_MULTIPLE_DATABASES | tr ',' ' '); do
		echo "Creating database: $db"
		psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
			CREATE DATABASE $db;
EOSQL
	done
	echo "Multiple databases created"
fi
