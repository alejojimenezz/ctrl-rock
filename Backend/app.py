from flask import Flask, jsonify
from flask_cors import CORS

import subprocess
import json

app = Flask(__name__)
CORS(app)


@app.route("/cotizar")
def cotizar():

    try:

        # Ejecuta el scraping
        subprocess.run(
            ["python", "prueba_scrapping.py"],
            check=True
        )

        # Lee el resultado generado
        with open(
            "resultado_cotizacion.json",
            "r",
            encoding="utf-8"
        ) as archivo:

            resultado = json.load(archivo)

        return jsonify(resultado)

    except Exception as e:

        return jsonify({
            "error": str(e)
        }), 500


if __name__ == "__main__":
    app.run(port=5000, debug=True)