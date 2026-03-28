package seed

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed data/programs
var programsFS embed.FS

type programMeta struct {
	ID          string
	Name        string
	Description string
	Author      string
	Category    string // "strength" | "hypertrophy" | "powerlifting"
	Level       string // "beginner" | "intermediate" | "advanced"
	IsActive    bool
}

//nolint:funlen,misspell // static catalog data in Spanish
var programCatalog = []programMeta{
	{ID: "gzclp", Name: "GZCLP", Description: "Como entrenar en el planeta de Kaio-sama: progresión lineal bajo presión constante. Rotación de 4 días con ejercicios T1, T2 y T3. Si fallas, cambias de etapa y sigues luchando. Inspirado en el método GZCL de Cody LeFever.", Author: "Gravity Room", Category: "strength", Level: "beginner", IsActive: true},
	{ID: "hexan-ppl", Name: "HeXaN PPL", Description: "Seis días de Kaioken: empuja tu cuerpo al máximo con fuerza y volumen. Push/Pull/Legs combinando 5/3/1 para los compuestos principales con doble progresión en accesorios. Inspirado en la metodología de HeXaN.", Author: "Gravity Room", Category: "hypertrophy", Level: "intermediate", IsActive: true},
	{ID: "stronglifts-5x5", Name: "StrongLifts 5x5", Description: "Programa clásico de fuerza para principiantes. Dos entrenamientos alternos (A/B), 3 días por semana. Sentadilla en cada sesión, progresión lineal de +2.5 kg por entrenamiento (+5 kg en peso muerto). Tres fallos consecutivos provocan una descarga del 10%.", Author: "Mehdi Hadim", Category: "strength", Level: "beginner", IsActive: true},
	{ID: "phraks-greyskull-lp", Name: "Phrak's Greyskull LP", Description: "Programa de fuerza para principiantes de Phrakture. Dos entrenamientos alternos (A/B), 3 días por semana. Cada ejercicio termina con una serie AMRAP (al fallo técnico). Progresión lineal con descarga del 10% al fallar.", Author: "Phrakture (r/Fitness)", Category: "strength", Level: "beginner", IsActive: true},
	{ID: "531-boring-but-big", Name: "5/3/1 Boring But Big", Description: "El secreto de la fuerza según el Maestro Roshi: repeticiones aburridas pero enormes resultados. Ciclos de 4 semanas (5s, 3s, 5/3/1, descarga) con 5×10 de volumen suplementario. 4 días por semana. Inspirado en 5/3/1 BBB de Jim Wendler.", Author: "Gravity Room", Category: "strength", Level: "intermediate", IsActive: true},
	{ID: "531-for-beginners", Name: "5/3/1 for Beginners", Description: "Entrenamiento de cuerpo completo en el Palacio Celeste: 3 días por semana, dos levantamientos principales por sesión. Ciclos de 3 semanas (5s, 3s, 5/3/1) con FSL 5×5 como suplemento. Metódico y equilibrado. Inspirado en 5/3/1 for Beginners de Jim Wendler.", Author: "Gravity Room", Category: "strength", Level: "beginner", IsActive: true},
	{ID: "phul", Name: "PHUL", Description: "Fuerza y tamaño como Vegeta en su cámara de gravedad: dos días de poder puro (compuestos pesados 3-5 reps) y dos de hipertrofia (8-12 reps). 4 días por semana. Inspirado en PHUL de Brandon Campbell.", Author: "Gravity Room", Category: "hypertrophy", Level: "intermediate", IsActive: true},
	{ID: "nivel-7", Name: "Nivel 7", Description: "Programa de fuerza de 12 semanas con periodización inversa. Configuras el récord objetivo (semana 6) y los pesos se calculan hacia atrás. Bloque 1 (5×5) con descarga en semana 3, Bloque 2 (3×3) culminando en récord. Ciclo 2 repite la onda con +2.5kg. Accesorios con doble progresión 3×8-12. 4 días/semana: hombros/tríceps, espalda/gemelo, pecho/bíceps, pierna.", Author: "nivel7 (musclecoop)", Category: "strength", Level: "intermediate", IsActive: true},
	{ID: "caparazon-de-tortuga", Name: "Caparazón de Tortuga", Description: "Tu entrenamiento en la Kame House: empieza desde cero con tu peso corporal y poco a poco añade la barra. 200 sesiones, 3 días/semana. 4 bloques por sesión: Core, Activación, Propiocepción y el Ejercicio Fundamental. Inspirado en la metodología de Amerigo Brunetti.", Author: "Gravity Room", Category: "strength", Level: "beginner", IsActive: true},
	{ID: "365-programmare-lipertrofia", Name: "365 Programmare l'Ipertrofia", Description: "Programa anual de hipertrofia de Amerigo Brunetti estructurado en 5 fases y 212 sesiones. Fase Zero (8 semanas): técnica con cargas mínimas. Fase T1 (6 semanas): introducción de carga en los tres levantamientos fundamentales. Fase PN (13 semanas): ramping progresivo con sobrecargas específicas. Fase JAW (18 semanas): 3 bloques independientes de intensificación con TM propios y test de 1RM al final de cada bloque. Fase IS (12 semanas): trabajo de aislamiento y consolidación, 12–30 repeticiones. 4 días por semana.", Author: "Amerigo Brunetti", Category: "hypertrophy", Level: "intermediate", IsActive: false},
	{ID: "la-sala-del-tiempo", Name: "La Sala del Tiempo", Description: "Inspirado en la metodología de Amerigo Brunetti. Tu año en la Sala del Tiempo: 196 sesiones de hipertrofia estructurada en 4 fases de intensidad creciente (T1, PN, JAW, IS). Solo para guerreros que ya dominan sentadilla, press banca y peso muerto. 4 días por semana.", Author: "Gravity Room", Category: "hypertrophy", Level: "intermediate", IsActive: false},
	{ID: "sala-del-tiempo-1", Name: "La Sala del Tiempo 1", Description: "Fase T1 — Perfezionamento Tecnico: 24 sesiones de técnica con cargas ligeras (40-70% TM). Isométricos, tempos y control del movimiento en sentadilla, press banca y peso muerto. 6 semanas, 4 días/semana. Inspirado en la metodología de Amerigo Brunetti.", Author: "Gravity Room", Category: "hypertrophy", Level: "intermediate", IsActive: true},
	{ID: "sala-del-tiempo-2", Name: "La Sala del Tiempo 2", Description: "Fase PN — Potenziamento Neurale: 52 sesiones de potenciación neural progresiva (60-95% TM). Ramping de cargas y series de fuerza para transferir técnica a pesos pesados. 13 semanas, 4 días/semana. Inspirado en la metodología de Amerigo Brunetti.", Author: "Gravity Room", Category: "hypertrophy", Level: "intermediate", IsActive: true},
	{ID: "sala-del-tiempo-3", Name: "La Sala del Tiempo 3", Description: "Fase JAW Mod — 72 sesiones de intensificación en 3 bloques de 6 semanas (60→70→80% TM). Cada bloque termina con test de 1RM que alimenta el TM del siguiente. 18 semanas, 4 días/semana. Inspirado en la metodología de Amerigo Brunetti.", Author: "Gravity Room", Category: "hypertrophy", Level: "intermediate", IsActive: true},
	{ID: "tenkaichi-budokai-sentadilla", Name: "Tenkaichi Budokai — Sentadilla", Description: "Preparación de 16 semanas para el torneo con énfasis en sentadilla. Porcentajes exactos de tu 1RM, periodización por mesociclos, deload antes de competir. 4 días por semana. Inspirado en la metodología de Boris Sheiko.", Author: "Gravity Room", Category: "powerlifting", Level: "advanced", IsActive: true},
	{ID: "tenkaichi-budokai-press-banca", Name: "Tenkaichi Budokai — Press Banca", Description: "Preparación de 16 semanas para el torneo con énfasis en press banca. Porcentajes exactos de tu 1RM, múltiples variaciones de banca. 4 días por semana. Inspirado en la metodología de Boris Sheiko.", Author: "Gravity Room", Category: "powerlifting", Level: "advanced", IsActive: true},
	{ID: "tenkaichi-budokai-peso-muerto", Name: "Tenkaichi Budokai — Peso Muerto", Description: "Preparación de 16 semanas para el torneo con énfasis en peso muerto. Déficit, bloques, cadenas, bandas — todas las variaciones de peso muerto. 4 días por semana. Inspirado en la metodología de Boris Sheiko.", Author: "Gravity Room", Category: "powerlifting", Level: "advanced", IsActive: true},
	{ID: "tenkaichi-budokai-solo-banca", Name: "Tenkaichi Budokai — Solo Banca", Description: "Preparación de 18 semanas exclusiva para press banca. Sin sentadilla ni peso muerto de competición — toda la energía en un solo golpe. 4 días por semana. Inspirado en la metodología de Boris Sheiko.", Author: "Gravity Room", Category: "powerlifting", Level: "advanced", IsActive: true},
	{ID: "tenkaichi-budokai-veterano", Name: "Tenkaichi Budokai — Veterano", Description: "El programa más popular de Sheiko para guerreros experimentados. 4 mesociclos de preparación con volumen medio y test de 1RM integrado. Usa tu experiencia de combate para llegar al torneo en tu mejor forma. 4 días por semana. Inspirado en la metodología de Boris Sheiko.", Author: "Gravity Room", Category: "powerlifting", Level: "advanced", IsActive: true},
	{ID: "furia-oscura", Name: "Furia Oscura", Description: "Entrena como un Saiyajin: Push/Pull/Legs con alternancia A/B semanal. 3 dias/semana al estilo Sala del Tiempo, doble progresion hasta superar tus limites.", Author: "Gravity Room", Category: "hypertrophy", Level: "intermediate", IsActive: true},
}

func seedProgramTemplates(ctx context.Context, pool *pgxpool.Pool) error {
	// Auto-complete active instances for deactivated templates.
	var deactivatingIDs []string
	for _, meta := range programCatalog {
		if !meta.IsActive {
			deactivatingIDs = append(deactivatingIDs, meta.ID)
		}
	}

	if len(deactivatingIDs) > 0 {
		_, err := pool.Exec(ctx, `
			UPDATE program_instances
			SET status = 'completed', updated_at = now()
			WHERE status = 'active' AND program_id = ANY($1)
		`, deactivatingIDs)
		if err != nil {
			return fmt.Errorf("auto-complete deactivated instances: %w", err)
		}
	}

	// Upsert each program template.
	for _, meta := range programCatalog {
		defBytes, err := programsFS.ReadFile(fmt.Sprintf("data/programs/%s.json", meta.ID))
		if err != nil {
			return fmt.Errorf("read definition for %s: %w", meta.ID, err)
		}

		// Validate JSON.
		var def json.RawMessage
		if err := json.Unmarshal(defBytes, &def); err != nil {
			return fmt.Errorf("invalid JSON for %s: %w", meta.ID, err)
		}

		_, err = pool.Exec(ctx, `
			INSERT INTO program_templates (id, name, description, author, version, category, level, source, definition, is_active)
			VALUES ($1, $2, $3, $4, 1, $5, $6, 'preset', $7, $8)
			ON CONFLICT (id) DO UPDATE SET
				name = EXCLUDED.name,
				description = EXCLUDED.description,
				author = EXCLUDED.author,
				version = EXCLUDED.version,
				category = EXCLUDED.category,
				level = EXCLUDED.level,
				source = EXCLUDED.source,
				definition = EXCLUDED.definition,
				is_active = EXCLUDED.is_active
		`, meta.ID, meta.Name, meta.Description, meta.Author,
			meta.Category, meta.Level, string(def), meta.IsActive)
		if err != nil {
			return fmt.Errorf("upsert template %s: %w", meta.ID, err)
		}
	}

	return nil
}
