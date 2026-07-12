"""
STINGRAY Scale Tool v3
======================
Menú secuencial de selección de escala:
  Paso 1: Selección de criterio
  Paso 2: Selección de opción
"""

import os, re, sys, glob, tkinter as tk
from tkinter import ttk, messagebox, filedialog

# ─────────────────────────────────────────────────────────
# DEFINICIÓN DE MODOS Y OPCIONES
# ─────────────────────────────────────────────────────────

MODES = {
    "Tamaño por tipo de jugador": [
        ("Tamaño completo     (4/4)  — Instrumento real",          1.0),
        ("Guitarra de viaje   (3/4)  — Viaje / práctica",          0.8),
        ("Niños / Junior      (1/2)  — Cuerpo y mástil corto",     0.6),
        ("Decorativa / Réplica       — Para exhibir",              0.4),
        ("Miniatura de colección     — Escala museo",              0.2),
    ],
    "Por edad del músico": [
        ("Adulto  (12+ años)  — Escala real",                      1.0),
        ("Joven   (8–12 años) — Tamaño reducido",                  0.8),
        ("Niño    (5–8 años)  — Tamaño infantil",                  0.6),
        ("Decorativa          — Sin uso musical",                  0.4),
    ],
    "Por uso": [
        ("Instrumento profesional  — Escala real",                 1.0),
        ("Instrumento de práctica  — Reducido cómodo",             0.8),
        ("Regalo / decoración      — Escala mediana",              0.4),
        ("Regalo / decoración      — Miniatura",                   0.2),
    ],
}

# ─────────────────────────────────────────────────────────
# LÓGICA DE ESCALA
# ─────────────────────────────────────────────────────────

POINT_RE = re.compile(
    r"(#\d+\s*=\s*(?:CARTESIAN_POINT|VERTEX_POINT)\s*\(\s*'[^']*'\s*,\s*\()([^)]+)(\)\s*\)\s*;)",
    re.IGNORECASE
)

def _parse(s):
    return [float(x) for x in re.findall(r'[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?', s)]

def _fmt(vals):
    return ', '.join(f'{v:.10g}' for v in vals)

def scale_step_file(src, dst, factor):
    with open(src, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()

    pts = [_parse(m.group(2))[:3]
           for m in POINT_RE.finditer(content)
           if len(_parse(m.group(2))) >= 3]

    if not pts:
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        with open(dst, 'w', encoding='utf-8') as f:
            f.write(content)
        return 0

    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    cz = sum(p[2] for p in pts) / len(pts)
    scx, scy, scz = cx * factor, cy * factor, cz * factor

    def transform(m):
        pre, cs, suf = m.group(1), m.group(2), m.group(3)
        c = _parse(cs)
        if len(c) >= 3:
            new = [scx + (c[0]-cx)*factor, scy + (c[1]-cy)*factor, scz + (c[2]-cz)*factor]
        else:
            new = [scx + (c[0]-cx)*factor, scy + (c[1]-cy)*factor]
        return pre + _fmt(new) + suf

    new_content, count = POINT_RE.subn(transform, content)
    new_content = re.sub(
        r"(FILE_NAME\s*\(\s*')([^']*?)(')",
        lambda m: m.group(1) + m.group(2) + f'_x{factor}' + m.group(3),
        new_content, count=1
    )

    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(dst, 'w', encoding='utf-8') as f:
        f.write(new_content)
    return count

def process_folder(folder, factor):
    files = sum([glob.glob(os.path.join(folder, f'*.{e}'))
                 for e in ('stp','step','STP','STEP')], [])
    if not files:
        return [], None

    out = os.path.join(folder, f'scaled_{factor}')
    results = []
    for src in files:
        name, ext = os.path.splitext(os.path.basename(src))
        dst = os.path.join(out, f'{name}_x{factor}{ext}')
        try:
            n = scale_step_file(src, dst, factor)
            results.append((os.path.basename(src), None))
        except Exception as e:
            results.append((os.path.basename(src), str(e)))
    return results, out

# ─────────────────────────────────────────────────────────
# INTERFAZ
# ─────────────────────────────────────────────────────────

BRAND   = '#1a3c5e'
ACCENT  = '#2980b9'
SUCCESS = '#27ae60'
WARN    = '#e67e22'
ERR     = '#c0392b'
BG      = '#f4f6f8'

class App:
    def __init__(self, root):
        self.root = root
        self.root.title('STINGRAY Scale Tool  v3')
        self.root.configure(bg=BG)
        self.root.resizable(False, False)

        self.folder_var  = tk.StringVar()
        self.criterion_var = tk.StringVar(value=list(MODES.keys())[0])
        self.option_var  = tk.IntVar(value=0)
        self.factor_var  = tk.DoubleVar(value=1.0)

        self._build()
        self._auto_folder()

    # ── construcción de la UI ──────────────────────────────

    def _build(self):
        # ---- Encabezado ----
        hdr = tk.Frame(self.root, bg=BRAND)
        hdr.pack(fill='x')
        tk.Label(hdr, text='🎸  STINGRAY Scale Tool  v3',
                 font=('Arial', 13, 'bold'), fg='white', bg=BRAND,
                 pady=10).pack()
        tk.Label(hdr,
                 text='Asistente paso a paso para procesar archivos STEP',
                 font=('Arial', 8), fg='#aad4f5', bg=BRAND, pady=4).pack()

        body = tk.Frame(self.root, bg=BG, padx=20, pady=15)
        body.pack(fill='both', expand=True)

        # ---- Carpeta ----
        tk.Label(body, text='Carpeta con archivos STEP:',
                 font=('Arial', 9, 'bold'), bg=BG, anchor='w').pack(anchor='w')
        fr = tk.Frame(body, bg=BG)
        fr.pack(fill='x', pady=(2, 15))
        tk.Entry(fr, textvariable=self.folder_var, width=50,
                 font=('Arial', 9), relief='solid', bd=1).pack(side='left', fill='x', expand=True)
        tk.Button(fr, text=' Buscar ', font=('Arial', 9), relief='flat',
                  bg='#dce3ea', command=self._browse).pack(side='left', padx=(4,0))

        # ---- Paso 1: Criterio ----
        tk.Label(body, text='Paso 1: ¿Por qué criterio buscas tu escala?',
                 font=('Arial', 10, 'bold'), bg=BG, fg=BRAND).pack(anchor='w', pady=(5,5))
        
        crit_frame = tk.Frame(body, bg=BG)
        crit_frame.pack(fill='x', padx=10)
        
        for idx, crit in enumerate(MODES.keys()):
            letter = ["a.", "b.", "c."][idx]
            rb = tk.Radiobutton(crit_frame, text=f"{letter} {crit}", variable=self.criterion_var, value=crit,
                                font=('Arial', 9), bg=BG, activebackground=BG,
                                command=self._build_options)
            rb.pack(anchor='w', pady=2)

        # ---- Paso 2: Opciones Dinámicas ----
        tk.Label(body, text='Paso 2: Selecciona la escala final',
                 font=('Arial', 10, 'bold'), bg=BG, fg=BRAND).pack(anchor='w', pady=(15,5))

        self.options_frame = tk.Frame(body, bg='white', relief='solid', bd=1, padx=15, pady=10)
        self.options_frame.pack(fill='x', padx=10, pady=(0, 15))

        # ---- Preview de factor ----
        self.lbl_factor = tk.Label(body, text='', font=('Arial', 11, 'bold'),
                                   bg=BG, fg=ACCENT)
        self.lbl_factor.pack(pady=(5,5))

        # ---- Status ----
        self.lbl_status = tk.Label(body, text='', font=('Arial', 9),
                                   bg=BG, fg='#555', wraplength=460, justify='center')
        self.lbl_status.pack(pady=(0,15))

        # ---- Botones acción ----
        btn_frame = tk.Frame(body, bg=BG)
        btn_frame.pack(pady=5)
        tk.Button(btn_frame, text='  ✔  Procesar archivos STEP  ',
                  font=('Arial', 10, 'bold'), bg=BRAND, fg='white',
                  relief='flat', padx=12, pady=7,
                  command=self._run).pack(side='left', padx=6)
        tk.Button(btn_frame, text='  ✖  Cancelar  ',
                  font=('Arial', 10), bg='#dce3ea', fg='#333',
                  relief='flat', padx=12, pady=7,
                  command=self.root.destroy).pack(side='left', padx=6)

        # Dibujar opciones iniciales
        self._build_options()

    def _build_options(self):
        # Limpiar el frame de opciones
        for w in self.options_frame.winfo_children():
            w.destroy()

        crit = self.criterion_var.get()
        opts = MODES[crit]
        
        # Resetear la selección a la primera opción
        self.option_var.set(0)

        for i, (label, factor) in enumerate(opts):
            row = tk.Frame(self.options_frame, bg='white')
            row.pack(anchor='w', fill='x', pady=2)
            
            rb = tk.Radiobutton(row, text=label, variable=self.option_var, value=i,
                                font=('Consolas', 9), bg='white', activebackground='white',
                                command=self._update_preview)
            rb.pack(side='left')
            
            badge_txt = f'→ escala {factor}'
            badge_col = {1.0:'#27ae60', 0.8:'#2980b9',
                         0.6:'#8e44ad', 0.4:'#e67e22', 0.2:'#c0392b'}.get(factor, '#555')
            
            tk.Label(row, text=badge_txt, font=('Arial', 9, 'bold'),
                     fg=badge_col, bg='white').pack(side='right', padx=(6,0))

        self._update_preview()

    def _update_preview(self):
        crit  = self.criterion_var.get()
        idx   = self.option_var.get()
        opts  = MODES[crit]
        
        # En caso de que se haya cambiado de categoría y el idx sea mayor que las opciones disponibles
        if idx >= len(opts):
            idx = 0
            self.option_var.set(0)
            
        label, factor = opts[idx]
        self.factor_var.set(factor)

        pct = int(factor * 100)
        color = {100:'#27ae60', 80:'#2980b9',
                 60:'#8e44ad', 40:'#e67e22', 20:'#c0392b'}.get(pct, '#333')

        self.lbl_factor.config(
            text=f'Escala seleccionada:  {factor}  ({pct}% del tamaño)',
            fg=color)
        self._update_status()

    def _update_status(self):
        folder = self.folder_var.get()
        if not folder or not os.path.isdir(folder):
            self.lbl_status.config(text='')
            return
        files = sum([glob.glob(os.path.join(folder, f'*.{e}'))
                     for e in ('stp','step','STP','STEP')], [])
        factor = self.factor_var.get()
        if files:
            self.lbl_status.config(
                text=f'✔  {len(files)} archivos STEP encontrados   →   salida: scaled_{factor}\\',
                fg=SUCCESS)
        else:
            self.lbl_status.config(
                text='⚠  No se encontraron archivos .stp / .step en esta carpeta.',
                fg=ERR)

    def _browse(self):
        f = filedialog.askdirectory(title='Seleccionar carpeta con archivos STEP')
        if f:
            self.folder_var.set(f)
            self._update_status()

    def _auto_folder(self):
        d = os.path.dirname(os.path.abspath(__file__))
        self.folder_var.set(d)
        self._update_status()

    def _run(self):
        folder = self.folder_var.get()
        factor = self.factor_var.get()

        if not folder or not os.path.isdir(folder):
            messagebox.showerror('Error', 'Seleccione una carpeta válida.')
            return

        crit = self.criterion_var.get()
        idx  = self.option_var.get()
        opcion_label = MODES[crit][idx][0].strip()

        confirm = (f'Criterio:  {crit}\n'
                   f'Opción:    {opcion_label}\n'
                   f'Factor:    {factor}  ({int(factor*100)}%)\n\n'
                   f'¿Procesar todos los archivos STEP de:\n{folder} ?')
        if messagebox.askyesno('Confirmar', confirm) == False:
            return

        self.lbl_status.config(text='⏳  Procesando...', fg=WARN)
        self.root.update()

        results, out_folder = process_folder(folder, factor)

        if not results:
            messagebox.showwarning('Sin archivos',
                                   'No se encontraron archivos .stp/.step.')
            self._update_status()
            return

        ok  = [r for r in results if r[1] is None]
        err = [r for r in results if r[1] is not None]

        msg = (f'✔  Procesados:  {len(ok)} / {len(results)} archivos\n'
               f'Factor:  {factor}  ({int(factor*100)}%)\n'
               f'Salida:  {out_folder}\n')
        if err:
            msg += f'\n⚠  Errores ({len(err)}):\n'
            for fname, e in err:
                msg += f'   • {fname}: {e}\n'
        msg += '\nPróximo paso: importar la carpeta de salida en Inventor / Fusion 360.'

        messagebox.showinfo('Completado', msg)
        if ok and sys.platform == 'win32':
            os.startfile(out_folder)
        self._update_status()

# ─────────────────────────────────────────────────────────
if __name__ == '__main__':
    root = tk.Tk()
    App(root)
    root.mainloop()