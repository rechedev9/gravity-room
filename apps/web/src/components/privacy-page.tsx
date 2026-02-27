import { Link } from 'react-router-dom';

export function PrivacyPage(): React.ReactNode {
  return (
    <div className="min-h-dvh bg-body">
      <header className="bg-header border-b border-rule px-6 sm:px-10 py-5">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link
            to="/"
            className="text-sm font-bold text-heading hover:opacity-80 transition-opacity"
          >
            &larr; Volver
          </Link>
          <span className="text-sm font-bold text-heading">Gravity Room</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 sm:px-10 py-10 sm:py-16">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-heading mb-8">
          Política de Privacidad
        </h1>

        <div className="space-y-8 text-sm text-muted leading-relaxed">
          <section>
            <h2 className="text-base font-bold text-main mb-2">Datos que Almacenamos</h2>
            <p>
              Todos los datos de entrenamiento (ejercicios, pesos, series, repeticiones y
              resultados) se almacenan localmente en el localStorage de tu navegador. Estos datos
              nunca salen de tu dispositivo a menos que habilites explícitamente la sincronización
              en la nube.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-main mb-2">
              Sincronización en la Nube (Opcional)
            </h2>
            <p>
              Si creas una cuenta, almacenamos tu dirección de correo electrónico y datos de
              entrenamiento en una base de datos segura (Railway PostgreSQL). Esto permite
              sincronización entre dispositivos. La sincronización en la nube es completamente
              opcional &mdash; la app funciona totalmente sin conexión sin una cuenta.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-main mb-2">
              Inicio de Sesión con Google (Opcional)
            </h2>
            <p>
              Si inicias sesión con Google, recibimos tu dirección de correo electrónico y nombre de
              perfil de Google. No accedemos a tus contactos, calendario ni ningún otro dato de
              Google.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-main mb-2">Analíticas y Seguimiento</h2>
            <p>
              No utilizamos ninguna analítica, cookies de seguimiento ni scripts de terceros. No se
              comparte ningún dato con anunciantes ni terceros.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-main mb-2">Eliminar tus Datos</h2>
            <p>
              <strong>Datos locales:</strong> Borra el localStorage de tu navegador o usa la opción
              &quot;Reiniciar Todo&quot; en la app.
            </p>
            <p className="mt-2">
              <strong>Datos en la nube:</strong> Si tienes una cuenta y deseas eliminar tus datos en
              la nube, contáctanos y eliminaremos tu cuenta y todos los datos asociados de nuestra
              base de datos.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-main mb-2">Contacto</h2>
            <p>
              Para preguntas sobre privacidad o solicitudes de eliminación de datos, abre un issue
              en el repositorio del proyecto o contacta al mantenedor.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
