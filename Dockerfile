FROM python:3.12-slim

WORKDIR /app

# Build dependencies for the C engine
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    make \
  && rm -rf /var/lib/apt/lists/*

# Python deps
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# App source
COPY . .

# Build the engine binary for this container architecture
RUN make -C engine clean && make -C engine

EXPOSE 8000

CMD ["python", "start.py"]

