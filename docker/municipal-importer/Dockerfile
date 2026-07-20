FROM postgis/postgis:16-3.4

RUN apt-get update \
  && apt-get install -y --no-install-recommends postgis postgresql-client \
  && rm -rf /var/lib/apt/lists/*
