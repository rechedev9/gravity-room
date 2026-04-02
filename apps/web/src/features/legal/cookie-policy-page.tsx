import { Link } from 'react-router-dom';

export function CookiePolicyPage(): React.ReactNode {
  return (
    <div className="min-h-dvh bg-body">
      <header className="bg-header border-b border-rule px-6 sm:px-10 py-5">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link to="/" className="text-sm font-bold text-title hover:opacity-80 transition-opacity">
            &larr; Volver
          </Link>
          <span className="text-sm font-bold text-title">Gravity Room</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 sm:px-10 py-10 sm:py-16">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-title mb-8">Política de Cookies</h1>

        <div className="space-y-8 text-sm text-muted leading-relaxed">
          <section>
            <h2 className="text-base font-bold text-main mb-2">¿Qué son las cookies?</h2>
            <p>
              Las cookies son pequeños archivos de texto que los sitios web almacenan en tu
              navegador. Pueden ser necesarias para el funcionamiento técnico del sitio o utilizarse
              con fines analíticos o publicitarios.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-main mb-2">
              ¿Qué cookies utiliza Gravity Room?
            </h2>
            <p className="mb-4">
              Gravity Room utiliza únicamente una cookie técnica estrictamente necesaria para el
              funcionamiento de la autenticación.{' '}
              <strong className="text-main">
                No utilizamos cookies de analítica, publicidad ni seguimiento de ningún tipo.
              </strong>
            </p>

            <div className="overflow-x-auto rounded-lg border border-rule">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-th text-label">
                    <th className="px-4 py-3 font-semibold">Nombre</th>
                    <th className="px-4 py-3 font-semibold">Tipo</th>
                    <th className="px-4 py-3 font-semibold">Finalidad</th>
                    <th className="px-4 py-3 font-semibold">Duración</th>
                    <th className="px-4 py-3 font-semibold">Titular</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-rule">
                    <td className="px-4 py-3 font-mono text-main">refresh_token</td>
                    <td className="px-4 py-3">Técnica (necesaria)</td>
                    <td className="px-4 py-3">
                      Mantener la sesión del usuario autenticado. Contiene un identificador opaco
                      (no datos personales). Es httpOnly y no accesible por JavaScript.
                    </td>
                    <td className="px-4 py-3">7 días</td>
                    <td className="px-4 py-3">Gravity Room (propia)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-base font-bold text-main mb-2">Cookies de terceros</h2>
            <p>
              Al utilizar el inicio de sesión con Google, el servicio de Google puede establecer sus
              propias cookies durante el proceso de autenticación. Estas cookies son gestionadas por
              Google y están sujetas a su{' '}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline hover:opacity-80 transition-opacity"
              >
                política de privacidad
              </a>
              . Gravity Room no controla ni tiene acceso a dichas cookies.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-main mb-2">Almacenamiento local</h2>
            <p>
              Además de la cookie mencionada, Gravity Room utiliza el almacenamiento local del
              navegador (localStorage) para guardar preferencias de visualización y datos de
              entrenamiento en modo invitado. Estos datos nunca se envían a ningún servidor y pueden
              eliminarse borrando los datos del sitio en tu navegador.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-main mb-2">Analítica</h2>
            <p>
              Gravity Room utiliza{' '}
              <a
                href="https://plausible.io/privacy-focused-web-analytics"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline hover:opacity-80 transition-opacity"
              >
                Plausible Analytics
              </a>
              , un servicio de analítica web respetuoso con la privacidad. Plausible no utiliza
              cookies, no recopila datos personales identificables y no rastrea usuarios entre
              sesiones. Los datos agregados (páginas vistas, país de origen, tipo de dispositivo) se
              utilizan únicamente para mejorar el servicio.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-main mb-2">Base legal</h2>
            <p>
              La cookie <span className="font-mono text-main">refresh_token</span> está exenta de
              consentimiento previo según el artículo 22.2 de la Ley 34/2002 (LSSI-CE), al ser
              estrictamente necesaria para la prestación del servicio de autenticación solicitado
              expresamente por el usuario. Esta exención está reconocida también por el Considerando
              66 de la Directiva 2009/136/CE y las directrices del Comité Europeo de Protección de
              Datos.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-main mb-2">¿Cómo desactivar las cookies?</h2>
            <p>
              Puedes configurar tu navegador para bloquear o eliminar cookies. Ten en cuenta que si
              bloqueas la cookie <span className="font-mono text-main">refresh_token</span>, no
              podrás mantener la sesión iniciada y tendrás que autenticarte de nuevo en cada visita.
              La app seguirá funcionando en modo invitado sin cookies.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-main mb-2">Contacto</h2>
            <p>
              Para preguntas sobre el uso de cookies, abre un issue en el repositorio del proyecto o
              contacta al mantenedor.
            </p>
          </section>

          <section>
            <p className="text-xs text-muted italic">Última actualización: marzo de 2026.</p>
          </section>
        </div>
      </main>
    </div>
  );
}
