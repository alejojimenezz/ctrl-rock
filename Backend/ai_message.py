import ollama

MODELOS = {
    "lespaul": "Gibson Les Paul",
    "stratocaster": "Fender Stratocaster",
    "ibanezxp": "Ibanez XP",
    "stingray": "Music Man StingRay",
    "ibanezrg": "Ibanez RG",
    "danelectro": "Danelectro",
}

MADERAS = {
    "fresno": "Fresno Americano",
    "caoba": "Caoba de Honduras",
    "nogal": "Nogal Negro Exótico",
}

ACABADOS = {
    "natural": "Natural",
    "carbon": "Carbon",
    "cherry": "Cherry Sunburst",
}


def generar_mensaje_personalizado(
    nombre,
    modelo,
    madera,
    acabado
):
    modelo = MODELOS.get(modelo, modelo)
    madera = MADERAS.get(madera, madera)
    acabado = ACABADOS.get(acabado, acabado)

    prompt = f"""
Eres un vendedor profesional de CTRL+ROCK.

Acaba de finalizar la compra de una guitarra personalizada.

Cliente:
{nombre}

Modelo:
{modelo}

Madera:
{madera}

Acabado:
{acabado}

Escribe un mensaje elegante y cercano.

Requisitos:

- Entre 90 y 130 palabras.
- Dirígete al cliente por su nombre.
- Menciona naturalmente el modelo elegido.
- Haz una breve referencia a la madera y al acabado.
- Agradece la confianza depositada en CTRL+ROCK.
- Comenta que el instrumento será construido cuidadosamente por nuestro equipo.
- Finaliza con una frase inspiradora relacionada con la música.
- No uses emojis.
- No uses listas.
- Escribe como si fueras una persona, no una IA.
"""

    try:

        respuesta = ollama.chat(
            model="llama3.2",
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            options={
                "temperature": 0.9,
                "top_p": 0.95
            }
        )

        return respuesta["message"]["content"]

    except Exception as e:

        print(f"Error usando Ollama: {e}")

        return (
            "Gracias por confiar en CTRL+ROCK. "
            "Nuestro equipo comenzará la fabricación de tu instrumento "
            "con el mayor cuidado y dedicación. Esperamos que disfrutes "
            "cada momento con tu nueva guitarra y que te acompañe durante "
            "muchos años de música."
        )
