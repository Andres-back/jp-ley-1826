/* Caso con audio · componente común (herramientas/componente-audio-caso; lo copia herramientas/casos_audio.py).
   index.html?caso=ID: el caso (uno o dos tramos: planteamiento y resolución) con su audio. Dos lados:
   · Escena: la ilustración aprobada del tema de la frase que suena y sus datos clave (rótulo de la ficha, fechas, normas, lugares,
     cantidades, personas, delitos), que aparecen cuando la voz los dice («que vaya de alguna forma representándose», Samir, 22/11).
   · Transcripción: el texto aprobado se revela palabra por palabra con la voz («que el audio tenga su transcripción a medida que va
     hablando»), en partes que avanzan solas; un clic en una palabra lleva el audio a ella; «Clic para ver el texto completo».
   Tiempos medidos en local con la transcripción del propio audio. Sin desplazamiento, sin tuteo, sin mayúsculas sostenidas. */
(function () {
  'use strict';
  var datos = JSON.parse(document.getElementById('datos-casos').textContent);
  var id = new URLSearchParams(location.search).get('caso') || Object.keys(datos.casos)[0];
  var caso = datos.casos[id], raiz = document.getElementById('caso');
  if (!caso) { raiz.innerHTML = '<p class="titulo">No se encontró el caso «' + esc(id) + '».</p>'; return; }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function mmss(s) { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function guardar(k, v) { try { localStorage.setItem('caso-audio-' + datos.clave + '-' + id + '-' + k, v); } catch (e) { /* sin almacenamiento */ } }
  function leer(k) { try { return localStorage.getItem('caso-audio-' + datos.clave + '-' + id + '-' + k); } catch (e) { return null; } }
  var reducido = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var T = caso.tramos, actual = 0, pagina = 0, paginas = [], manual = 0, completo = false, velocidades = [1, 1.25, 0.75];
  var audio = new Audio();
  audio.preload = 'metadata';

  raiz.innerHTML =
    '<header class="cab"><span class="cab-ico" aria-hidden="true"><i class="fas fa-headphones"></i></span><div class="cab-txt">' +
    '<p class="eyebrow">' + esc(caso.eyebrow) + '</p><h1 class="titulo">' + esc(caso.titulo) + '</h1></div>' +
    (caso.video ? '<button type="button" class="ver-video"><i class="fas fa-circle-play" aria-hidden="true"></i><span>Clic para ver el video del caso</span></button>' : '') +
    '</header>' +
    (T.length > 1 ? '<div class="pasos" role="tablist" aria-label="Partes del caso">' + T.map(function (t, i) {
      return '<button type="button" class="paso" role="tab" data-i="' + i + '" aria-selected="false"><span class="n">' + (i + 1) + '</span><span>' + esc(t.rotulo) +
        '<small>' + esc(t.sub || '') + '</small></span><i class="fas fa-circle-check visto" aria-hidden="true"></i></button>';
    }).join('') + '</div>' : '') +
    '<div class="cuerpo">' +
    '<section class="escena" aria-label="Escena del caso"><div class="lienzo-esc"><div class="capa-esc"></div><div class="capa-esc"></div></div>' +
    '<ul class="datos" aria-label="Datos del caso"></ul></section>' +
    '<section class="trans" aria-label="Transcripción del audio"><p class="trans-cab"><span class="vivo" aria-hidden="true"></span>Transcripción' +
    '<button type="button" class="todo" aria-pressed="false">Clic para ver el texto completo</button></p><div class="texto"></div>' +
    '<div class="nav"><button type="button" class="ant" aria-label="Parte anterior"><i class="fas fa-arrow-left" aria-hidden="true"></i></button>' +
    '<span class="parte"></span><button type="button" class="sig" aria-label="Parte siguiente"><i class="fas fa-arrow-right" aria-hidden="true"></i></button></div>' +
    '<div class="sigue" role="status"><i class="fas fa-lightbulb" aria-hidden="true"></i><span>Antes de escuchar la resolución, piense cómo resolvería el caso.</span>' +
    '<button type="button">Clic para escuchar la resolución</button></div></section></div>' +
    '<div class="reproductor"><button type="button" class="play latido" aria-label="Reproducir el audio"><i class="fas fa-play" aria-hidden="true"></i></button>' +
    /* Aviso mientras el audio está en pausa o sin iniciar (JP, 24/11/2026, por Samir en el chat de la coordinadora; en usted): se
       quita mientras suena (.sonando). */
    '<span class="aviso-audio" role="status"><i class="fas fa-headphones" aria-hidden="true"></i>Reproduzca el audio</span>' +
    '<span class="ondas" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>' +
    '<span class="barra"><i></i><input type="range" min="0" max="1000" value="0" aria-label="Avance del audio"></span>' +
    '<span class="tiempo">0:00 / 0:00</span><button type="button" class="vel" aria-label="Velocidad de la voz">1×</button>' +
    '<span class="voz"><i class="fas fa-microphone-lines" aria-hidden="true"></i><span class="voz-txt"></span></span>' +
    '<button type="button" class="pc" aria-label="Pantalla completa"><i class="fas fa-expand" aria-hidden="true"></i></button></div>';

  var $ = function (s) { return raiz.querySelector(s); };
  var play = $('.play'), barra = $('.barra i'), rango = $('.barra input'), tiempo = $('.tiempo'), vel = $('.vel'), texto = $('.texto');
  var ant = $('.ant'), sig = $('.sig'), parte = $('.parte'), sigue = $('.sigue'), lista = $('.datos'), todo = $('.todo');
  var capasEsc = [].slice.call(raiz.querySelectorAll('.capa-esc'));

  /* Frases del tramo con sus palabras (texto, segundo) y su párrafo. */
  var F = [];
  function frases(t) {
    var out = [];
    t.parrafos.forEach(function (p, k) { p.frases.forEach(function (f) { out.push({ t: f.t, ini: f.ini, w: f.w || [[f.t, f.ini]], p: k, meta: !!p.meta, e: f.e, img: f.img, datos: f.datos || [] }); }); });
    out.forEach(function (f, i) { f.i = i; f.fin = i + 1 < out.length ? out[i + 1].ini : Infinity; });
    return out;
  }
  /* Trozos: una frase entera ({f, a: 0, b: n}) o, si una frase sola no cabe (celular de pie), un tramo de sus palabras (a..b),
     cortado de preferencia tras una coma. Nada se corta ni se esconde: todas las palabras quedan en alguna parte. */
  function pintar(trozos) {
    var html = '', abierto = -1;
    trozos.forEach(function (tz) {
      var f = tz.f;
      if (f.p !== abierto) { if (abierto >= 0) html += '</p>'; html += '<p' + (f.meta ? ' class="meta"' : '') + '>'; abierto = f.p; }
      var rot = f.meta && /^([^:]{2,45}:)/.exec(f.t), resto = rot ? rot[1].split(/\s+/).length : 0;
      for (var j = tz.a; j < tz.b; j++) {
        var w = f.w[j];
        html += '<span class="pal' + (j < resto ? ' rot' : '') + '" data-s="' + w[1] + '" data-f="' + f.i + '">' + esc(w[0]) + '</span> ';
      }
    });
    texto.innerHTML = html + (abierto >= 0 ? '</p>' : '');
  }
  function largoDe(tz) { var n = 0; for (var j = tz.a; j < tz.b; j++) n += tz.f.w[j][0].length + 1; return n; }
  function inicioDe(pag) { var tz = pag[0]; return tz.f.w[tz.a] ? tz.f.w[tz.a][1] : tz.f.ini; }
  var fsBase = 16;
  function repartir() {
    var cabe = function () { return texto.scrollHeight <= texto.clientHeight + 1; };
    var todos = F.map(function (f) { return { f: f, a: 0, b: f.w.length }; });
    var total = todos.reduce(function (a, tz) { return a + largoDe(tz); }, 0);
    fsBase = raiz.clientWidth < 560 ? 14 : 16;
    for (var fs = 20; fs >= fsBase; fs--) {
      texto.style.setProperty('--fs', fs + 'px'); pintar(todos);
      if (cabe() && total <= 520) { paginas = [todos]; return; }
    }
    texto.style.setProperty('--fs', fsBase + 'px');
    paginas = []; var pag = [], largo = 0, cola = todos.slice();
    while (cola.length) {
      var tz = cola.shift(); pag.push(tz); largo += largoDe(tz); pintar(pag);
      if (cabe() && !(largo > 460 && pag.length > 1)) continue;
      if (pag.length > 1) { pag.pop(); paginas.push(pag); pag = []; largo = 0; cola.unshift(tz); continue; }
      if (tz.b - tz.a < 4) { paginas.push(pag); pag = []; largo = 0; continue; }
      var lo = 1, hi = tz.b - tz.a - 1, mejor = 1;
      while (lo <= hi) { var m = (lo + hi) >> 1; pintar([{ f: tz.f, a: tz.a, b: tz.a + m }]); if (cabe()) { mejor = m; lo = m + 1; } else hi = m - 1; }
      var corte = mejor;
      for (var j = mejor; j > mejor * 0.6; j--) if (/[,;:]$/.test(tz.f.w[tz.a + j - 1][0])) { corte = j; break; }
      paginas.push([{ f: tz.f, a: tz.a, b: tz.a + corte }]); pag = []; largo = 0;
      cola.unshift({ f: tz.f, a: tz.a + corte, b: tz.b });
    }
    if (pag.length) paginas.push(pag);
  }
  var PAL = [];
  function irPagina(k) {
    pagina = Math.max(0, Math.min(paginas.length - 1, k));
    pintar(paginas[pagina]);
    if (paginas.length > 1) {
      for (var fs = 21; fs > fsBase; fs--) { texto.style.setProperty('--fs', fs + 'px'); if (texto.scrollHeight <= texto.clientHeight + 1) break; }
      if (texto.scrollHeight > texto.clientHeight + 1) texto.style.setProperty('--fs', fsBase + 'px');
    }
    PAL = [].slice.call(texto.querySelectorAll('.pal'));
    ant.disabled = pagina === 0; sig.disabled = pagina === paginas.length - 1;
    parte.textContent = paginas.length > 1 ? 'Parte ' + (pagina + 1) + ' de ' + paginas.length : '';
    $('.nav').style.visibility = paginas.length > 1 ? '' : 'hidden';
    mostrados = ''; marcar();
  }
  function paginaEn(s) { var k = 0; paginas.forEach(function (p, i) { if (inicioDe(p) <= s + 0.05) k = i; }); return k; }
  function fraseEn(s) { for (var i = F.length - 1; i >= 0; i--) if (F[i].ini <= s + 0.05) return i; return 0; }

  /* ---------- Escena SVG coherente con la frase (Samir, 22/11/2026: «que sea coherente») ----------
     Quien aparece es quien nombra la frase, con el sexo que le da el texto (reparto del caso), su papel (ropa y objeto en la mano) y
     su acción (pose); la institución, como edificio con su rótulo; los objetos (fecha en el calendario, botellas, vivienda, audiencia,
     documento, plazo, investigación, celular, dinero). Una persona de sexo no dicho: silueta neutra. La agresión no se dibuja.
     Personajes planos de Juan (personajes.js): pantalón azul marino, camisas claras, cabello oscuro, sombra elíptica. */
  /* Branding del curso (Samir, 22/11/2026: «estéticamente debe seguir el branding de este curso»): los objetos, en la paleta oficial
     del kit (#E4F0F0, #EEB8AE, #E4E491, #343335, #DA6141, #36130A); las personas, vestidas con los colores de las ilustraciones
     aprobadas de Daniela para este curso (medidos en recursos/ilustraciones-ley/ley-d-*.webp): azul grisáceo, verde oscuro, petróleo,
     naranja, amarillo y salmón, con el azul casi negro de su cabello y sus pantalones. */
  var PJ = window.Personajes, K = PJ && PJ.C;
  var PALK = { marron: '#36130A', naranja: '#DA6141', carbon: '#343335', celeste: '#E4F0F0', salmon: '#EEB8AE', amarillo: '#E4E491' };
  var DAN = { grisazul: '#90A8B4', verde: '#306054', petroleo: '#003C54', naranja: '#C04818', amarillo: '#E4E490', salmon: '#E4B4A8',
    celeste: '#C0D8D8', noche: '#001824', piel: ['#F0D8CC', '#D8B4A8', '#CC7860'] };
  if (K) Object.assign(K, { teal: PALK.marron, oxido: PALK.naranja, gris: PALK.carbon, niebla: PALK.celeste, crema: PALK.amarillo, coral: PALK.salmon,
    celeste: PALK.celeste, tealClaro: PALK.salmon, marino: PALK.carbon, madera: PALK.marron, zapato: DAN.noche, toga: DAN.noche, pelo: DAN.noche, piel: DAN.piel });
  var ROPA = {
    acusado: { camisa: DAN.grisazul }, indiciado: { camisa: DAN.grisazul }, procesado: { camisa: DAN.grisazul },
    victima: { camisa: DAN.salmon }, testigo: { camisa: DAN.celeste }, nino: { camisa: DAN.amarillo },
    fiscal: { camisa: '#FFFFFF', chaqueta: DAN.verde }, asistente: { camisa: '#FFFFFF', chaqueta: DAN.grisazul },
    apoderado: { camisa: '#FFFFFF', chaqueta: DAN.petroleo }, defensa: { camisa: '#FFFFFF', chaqueta: DAN.petroleo },
    mediador: { camisa: DAN.amarillo, chaqueta: DAN.verde }, perito: { camisa: '#FFFFFF', chaqueta: DAN.celeste },
    supervisor: { camisa: DAN.amarillo, chaqueta: DAN.naranja }, juez: { toga: true }
  };
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
  function silueta(x, y, s, color) {
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><ellipse cx="0" cy="0" rx="34" ry="6" fill="#000" opacity=".08"/>' +
      '<path d="M-24 0 V-70 Q-24 -96 0 -96 Q24 -96 24 -70 V0 Z" fill="' + color + '"/><circle cx="0" cy="-118" r="19" fill="' + color + '"/></g>';
  }
  /* Persona: el personaje aprobado del banco del curso que le asigna el reparto (mismo en todas las frases), mirando hacia quien
     tiene al lado; sin figura (sexo no dicho o sin personaje aprobado): un ícono del curso con su rótulo. */
  var GLIFO = { defensa: '', nino: '', grupo: '' };
  function icono(x, y, rol) {
    return '<g transform="translate(' + x + ' ' + (y - 58) + ')"><circle r="40" fill="' + PALK.celeste + '" stroke="' + DAN.grisazul + '" stroke-width="3"/>' +
      '<text y="15" text-anchor="middle" font-family="&quot;Font Awesome 6 Free&quot;" font-weight="900" font-size="40" fill="' + DAN.petroleo + '">' + (GLIFO[rol] || '') + '</text></g>';
  }
  function figura(id, x, y, alto, ancho, haciaDer) {
    var r = caso.reparto && caso.reparto[id] || { rol: 'testigo', genero: 'n', etiqueta: id };
    if (!r.figura) return icono(x, y, r.rol);
    var h = Math.min(alto, ancho / r.aspecto), w = h * r.aspecto, voltear = r.mira !== 0 && haciaDer !== null && (r.mira === 1) !== haciaDer;
    var img = '<image href="' + esc(r.figura) + '" x="' + (x - w / 2).toFixed(1) + '" y="' + (y - h).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '"/>';
    return '<ellipse cx="' + x + '" cy="' + (y - 2) + '" rx="' + (w * 0.38).toFixed(1) + '" ry="5" fill="#000" opacity=".08"/>' +
      (voltear ? '<g transform="translate(' + (2 * x) + ' 0) scale(-1 1)">' + img + '</g>' : img);
  }
  function rotulo(x, y, t) { return PJ.obj.etiqueta(x, y, esc(t), PALK.marron, '#FFFFFF', 10); }
  /* Rótulo de una persona: el nombre (en dos líneas si es largo) y, debajo, su papel entre paréntesis, sin fondo, con halo blanco. */
  function rotuloPersona(x, y, t) {
    var m = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(t), nombre = m ? m[1] : t, papel = m ? m[2] : '';
    var lineas = [nombre];
    if (nombre.length > 13) { var c = nombre.lastIndexOf(' ', Math.ceil(nombre.length / 2) + 2); if (c > 0) lineas = [nombre.slice(0, c), nombre.slice(c + 1)]; }
    var txt = function (s, dy, peso, tam, color) {
      return '<text x="' + x + '" y="' + (y + dy) + '" text-anchor="middle" font-family="Montserrat,Arial,sans-serif" font-weight="' + peso + '" font-size="' + tam +
        '" fill="' + color + '" stroke="#fff" stroke-width="3" paint-order="stroke">' + esc(s) + '</text>';
    };
    return lineas.map(function (l, i) { return txt(l, i * 11, 800, 10, PALK.marron); }).join('') + (papel ? txt(papel, lineas.length * 11, 600, 8.5, '#5E5E60') : '');
  }
  var MES3 = { Enero: 'Ene.', Febrero: 'Feb.', Marzo: 'Mar.', Abril: 'Abr.', Mayo: 'May.', Junio: 'Jun.', Julio: 'Jul.', Agosto: 'Ago.',
    Septiembre: 'Sep.', Octubre: 'Oct.', Noviembre: 'Nov.', Diciembre: 'Dic.' };
  var OBJ = {
    calendario: function (o, x, y) { return PJ.obj.calendario(x, y, 58, o.dia, MES3[o.mes] || o.mes, o.anio); },
    botellas: function (o, x, y) {
      return '<g transform="translate(' + x + ' ' + y + ')">' + [0, 1, 2, 3].map(function (i) {
        return '<g transform="translate(' + (i * 15) + ' 0)"><rect x="0" y="-34" width="12" height="34" rx="4" fill="' + (i % 2 ? PALK.marron : PALK.carbon) + '"/>' +
          '<rect x="3.5" y="-44" width="5" height="11" rx="2" fill="' + PALK.carbon + '"/><rect x="1" y="-24" width="10" height="9" rx="1" fill="' + PALK.amarillo + '"/></g>';
      }).join('') + '</g>';
    },
    casa: function (o, x, y) {
      return '<g transform="translate(' + x + ' ' + y + ')"><path d="M-6 -78 L38 -112 L82 -78 Z" fill="' + PALK.naranja + '"/><rect x="0" y="-80" width="76" height="80" fill="#FFFFFF" stroke="' + PALK.celeste + '" stroke-width="3"/>' +
        PJ.obj.puerta(26, -52, 24, 52, PALK.marron) + '<rect x="6" y="-66" width="16" height="16" rx="2" fill="' + PALK.celeste + '"/></g>';
    },
    estrado: function (o, x, y) { return PJ.obj.estrado(x, y - 56, 84, 56, PALK.marron); },
    reloj: function (o, x, y) { return PJ.obj.reloj(x, y, 22); },
    hoja: function (o, x, y) { return PJ.obj.hoja(x, y, 0.9, -6); },
    lupa: function (o, x, y) { return PJ.obj.lupa(x, y, 15); },
    celular: function (o, x, y) {
      return '<g transform="translate(' + x + ' ' + y + ') rotate(-8)"><rect width="26" height="46" rx="5" fill="' + PALK.carbon + '"/><rect x="3" y="5" width="20" height="33" rx="2" fill="' + PALK.celeste + '"/>' +
        '<path d="M10 16 L18 21 L10 26 Z" fill="' + PALK.naranja + '"/></g>';
    },
    billete: function (o, x, y) {
      return '<g transform="translate(' + x + ' ' + y + ') rotate(-6)"><rect width="52" height="28" rx="4" fill="' + PALK.amarillo + '"/><rect x="4" y="4" width="44" height="20" rx="3" fill="none" stroke="#fff" stroke-width="1.5"/>' +
        '<circle cx="26" cy="14" r="6" fill="' + PALK.naranja + '" opacity=".8"/></g>';
    },
    expediente: function (o, x, y) { return PJ.obj.carpetas(x, y, 4) + PJ.obj.hoja(x + 70, y - 60, 0.9, 8); }
  };
  function dibujar(e) {
    var W = 360, piso = 212, partes = ['<rect x="0" y="' + piso + '" width="' + W + '" height="60" fill="#000" opacity=".045"/>'];
    var inst = (e.i || [])[0], gente = e.p || [], objs = e.o || [];
    if (inst) {   // la institución al fondo, a la derecha, con su rótulo
      var ins = caso.instituciones && caso.instituciones[inst] || { etiqueta: inst };
      partes.push('<g opacity=".9">' + PJ.obj.corte(gente.length ? 262 : 128, gente.length ? 26 : 40, gente.length ? 84 : 104) + '</g>',
        rotulo(gente.length ? 304 : 180, gente.length ? 102 : 130, ins.etiqueta));
    }
    var arriba = [[16, 14], [W - 70, 18]], abajo = [[16, piso], [W - 96, piso]];
    objs.forEach(function (o, k) {
      if (!OBJ[o.t]) return;
      if (o.t === 'calendario') { var p0 = arriba.shift() || [16, 14]; partes.push(OBJ.calendario(o, p0[0], p0[1])); return; }
      if (o.t === 'reloj' || o.t === 'hoja' || o.t === 'lupa' || o.t === 'celular' || o.t === 'billete') {
        var p1 = (inst ? arriba.slice(0, 1) : arriba).shift(); if (!p1) return; arriba = arriba.filter(function (a) { return a !== p1; });
        partes.push(OBJ[o.t](o, p1[0] + (o.t === 'reloj' || o.t === 'lupa' ? 28 : 6), p1[1] + (o.t === 'reloj' || o.t === 'lupa' ? 30 : 4))); return;
      }
      var p2 = abajo.shift(); if (!p2) return;
      partes.push(OBJ[o.t](o, p2[0], p2[1]));
    });
    if (!gente.length && !objs.length && !inst) partes.push(OBJ.expediente({}, 120, piso));
    /* Las personas se reparten en el espacio que dejan libre los objetos de abajo (a la izquierda y a la derecha). */
    var n = gente.length, bajos = objs.filter(function (o) { return ['botellas', 'casa', 'estrado', 'expediente'].indexOf(o.t) >= 0; }).length;
    var L = bajos >= 1 ? 96 : 14, R = bajos >= 2 ? 262 : 346, paso = n ? (R - L) / n : 0;
    var alto = n === 1 ? 172 : n === 2 ? 162 : 142;
    /* Todas las personas de la escena a la misma altura: la que da la figura más ancha en su espacio. */
    gente.forEach(function (g) { var r = caso.reparto && caso.reparto[g[0]]; if (r && r.figura) alto = Math.min(alto, paso * 1.08 / r.aspecto); });
    gente.forEach(function (g, k) {
      var x = L + paso * (k + 0.5), haciaDer = n === 1 ? null : k === 0;
      partes.push('<g class="actor" style="--k:' + k + '">' + figura(g[0], x, piso, alto, paso * 1.08, haciaDer) + '</g>');
      var r = caso.reparto && caso.reparto[g[0]];
      if (r) partes.push(rotuloPersona(x, piso + 16, r.etiqueta));
    });
    return '<svg viewBox="0 0 ' + W + ' 250" preserveAspectRatio="xMidYMax meet" aria-hidden="true">' + partes.join('') + '</svg>';
  }
  var capas = capasEsc, capaV = 0, escClave = null;
  /* La escena de la frase: su ilustración (generada con la referencia de estilo del curso y aprobada) o, si no tiene, la composición
     con los personajes aprobados. Fundido entre dos capas. */
  function escenaDe(f) {
    var clave = f.img || JSON.stringify(f.e || {});
    if (clave === escClave) return;
    if (!f.img && (!PJ || !f.e)) return;
    escClave = clave;
    var sale = capas[capaV]; capaV = 1 - capaV; var entra = capas[capaV];
    entra.classList.toggle('foto', !!f.img);
    entra.innerHTML = f.img ? '<img src="' + esc(f.img) + '" alt="">' : dibujar(f.e);
    var mostrar = function () { entra.classList.add('ver'); sale.classList.remove('ver'); };
    var im = entra.querySelector('img');
    if (im && !im.complete) im.onload = mostrar; else mostrar();
  }
  var mostrados = '';
  function datosHasta(fi, s) {
    /* Los datos de la parte en curso que la voz ya dijo (con el texto completo a la vista, todos los de la parte); los últimos cinco. */
    var pag = paginas[pagina] || [], out = [], vistas = {}, desde = pag.length ? inicioDe(pag) - 0.05 : 0;
    pag.forEach(function (tz) {
      var f = tz.f; if (vistas[f.i]) return; vistas[f.i] = true;
      f.datos.forEach(function (d) { if (d.s >= desde && (completo || f.i < fi || (f.i === fi && d.s <= s + 0.05))) out.push(d); });
    });
    out = out.slice(-5);
    var clave = out.map(function (d) { return d.s + d.t; }).join('|');
    if (clave === mostrados) return;
    var antes = mostrados.split('|'); mostrados = clave;
    lista.innerHTML = out.map(function (d) {
      var nuevo = antes.indexOf(d.s + d.t) < 0 && !reducido;
      return '<li class="dato ' + d.tipo + (nuevo ? ' entra' : '') + '"><i class="fas ' + esc(d.ico) + '" aria-hidden="true"></i><span>' +
        (d.rot ? '<b>' + esc(d.rot) + '</b>' + (d.t ? ' ' : '') : '') + esc(d.t) + '</span></li>';
    }).join('');
  }
  function marcar() {
    var s = audio.currentTime || 0, empezado = s > 0.05 || !audio.paused;
    var primera = paginas[pagina] && paginas[pagina][0] ? paginas[pagina][0].f.i : 0;
    var fi = empezado ? fraseEn(s) : primera, ultima = -1;
    PAL.forEach(function (e, k) {
      var dicha = empezado && Number(e.dataset.s) <= s + 0.05;
      e.classList.toggle('dicha', completo || dicha);
      if (dicha) ultima = k;
    });
    PAL.forEach(function (e, k) { e.classList.toggle('actual', k === ultima && !audio.paused); });
    var f = F[Math.max(fi, primera)] || F[fi];
    if (f) escenaDe(f);
    datosHasta(empezado ? fi : -1, s);
  }
  function tramo(i) {
    actual = i; var t = T[i];
    raiz.querySelectorAll('.paso').forEach(function (b, k) { b.setAttribute('aria-selected', String(k === i)); b.classList.toggle('escuchado', leer(T[k].clave) === '1'); });
    audio.pause(); audio.src = t.archivo; audio.playbackRate = 1; vel.textContent = '1×';
    $('.voz-txt').textContent = t.voz || '';
    F = frases(t); sigue.classList.remove('ver'); manual = 0;
    repartir(); irPagina(0); actualizar();
    play.classList.add('latido');
  }
  function actualizar() {
    var d = audio.duration || T[actual].duracion || 0, c = audio.currentTime || 0;
    barra.style.width = (d ? 100 * c / d : 0) + '%'; rango.value = d ? Math.round(1000 * c / d) : 0;
    tiempo.textContent = mmss(c) + ' / ' + mmss(d);
    play.innerHTML = '<i class="fas fa-' + (audio.paused ? 'play' : 'pause') + '" aria-hidden="true"></i>';
    play.setAttribute('aria-label', audio.paused ? 'Reproducir el audio' : 'Pausar el audio');
    raiz.classList.toggle('sonando', !audio.paused);
    if (!audio.paused && Date.now() - manual > 6000) {
      var k = paginaEn(c);
      if (k !== pagina) { irPagina(k); return; }
    }
    marcar();
    if (d && c >= d * 0.95 && leer(T[actual].clave) !== '1') { guardar(T[actual].clave, '1'); var b = raiz.querySelectorAll('.paso')[actual]; if (b) b.classList.add('escuchado'); }
  }
  play.addEventListener('click', function () { play.classList.remove('latido'); if (audio.paused) audio.play().catch(function () {}); else audio.pause(); });
  rango.addEventListener('input', function () { if (audio.duration) { audio.currentTime = audio.duration * rango.value / 1000; manual = 0; actualizar(); } });
  vel.addEventListener('click', function () {
    var k = (velocidades.indexOf(audio.playbackRate) + 1) % velocidades.length;
    audio.playbackRate = velocidades[k]; vel.textContent = String(velocidades[k]).replace('.', ',') + '×';
  });
  ['timeupdate', 'play', 'pause', 'loadedmetadata', 'seeked'].forEach(function (e) { audio.addEventListener(e, actualizar); });
  /* «timeupdate» llega cada ~250 ms: entre uno y otro, la palabra actual avanza con requestAnimationFrame. */
  (function paso() { if (!audio.paused) marcar(); requestAnimationFrame(paso); })();
  audio.addEventListener('ended', function () {
    guardar(T[actual].clave, '1'); actualizar();
    if (actual + 1 < T.length) sigue.classList.add('ver');
  });
  texto.addEventListener('click', function (e) {
    var p = e.target.closest('.pal'); if (!p) return;
    audio.currentTime = Number(p.dataset.s); manual = 0; play.classList.remove('latido'); audio.play().catch(function () {});
  });
  todo.addEventListener('click', function () {
    completo = !completo; todo.setAttribute('aria-pressed', String(completo));
    todo.textContent = completo ? 'Clic para seguir la voz' : 'Clic para ver el texto completo';
    raiz.classList.toggle('completo', completo); mostrados = ''; marcar();
  });
  ant.addEventListener('click', function () { manual = Date.now(); irPagina(pagina - 1); });
  sig.addEventListener('click', function () { manual = Date.now(); irPagina(pagina + 1); });
  raiz.querySelectorAll('.paso').forEach(function (b) { b.addEventListener('click', function () { tramo(Number(b.dataset.i)); }); });
  sigue.querySelector('button').addEventListener('click', function () { tramo(actual + 1); play.classList.remove('latido'); audio.play().catch(function () {}); });
  /* Video del caso ya entregado (U2 y U4): en una ventana sobre el caso, con «Cerrar» visible y Escape; la voz se pausa. */
  if (caso.video) {
    var ventana = document.createElement('div');
    ventana.className = 'ventana'; ventana.hidden = true; ventana.setAttribute('role', 'dialog'); ventana.setAttribute('aria-modal', 'true');
    ventana.setAttribute('aria-label', 'Video del caso');
    ventana.innerHTML = '<div class="ventana-caja"><button type="button" class="cerrar"><i class="fas fa-xmark" aria-hidden="true"></i> Cerrar</button>' +
      '<iframe title="Video del caso" allow="fullscreen" allowfullscreen></iframe></div>';
    raiz.appendChild(ventana);
    var abrirVideo = function () { audio.pause(); ventana.querySelector('iframe').src = caso.video; ventana.hidden = false; ventana.querySelector('.cerrar').focus(); };
    var cerrarVideo = function () { ventana.hidden = true; ventana.querySelector('iframe').removeAttribute('src'); raiz.querySelector('.ver-video').focus(); };
    raiz.querySelector('.ver-video').addEventListener('click', abrirVideo);
    ventana.querySelector('.cerrar').addEventListener('click', cerrarVideo);
    ventana.addEventListener('click', function (e) { if (e.target === ventana) cerrarVideo(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !ventana.hidden) cerrarVideo(); });
  }
  /* Pantalla completa (como en todos los HTML embebidos): la de la página; si el iframe no la permite, el caso en otra pestaña. */
  $('.pc').addEventListener('click', function () {
    if (document.fullscreenElement) { document.exitFullscreen(); return; }
    var el = document.documentElement;
    if (el.requestFullscreen && document.fullscreenEnabled) el.requestFullscreen().catch(function () { window.open(location.href, '_blank'); });
    else window.open(location.href, '_blank');
  });
  document.addEventListener('fullscreenchange', function () {
    $('.pc').setAttribute('aria-label', document.fullscreenElement ? 'Salir de pantalla completa' : 'Pantalla completa');
    $('.pc').innerHTML = '<i class="fas fa-' + (document.fullscreenElement ? 'compress' : 'expand') + '" aria-hidden="true"></i>';
    repartir(); irPagina(0);
  });
  var espera;
  window.addEventListener('resize', function () { clearTimeout(espera); espera = setTimeout(function () { repartir(); irPagina(0); }, 150); });
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function () { tramo(0); });
})();
