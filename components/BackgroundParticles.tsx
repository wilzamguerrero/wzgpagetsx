import React from 'react';

interface BackgroundParticlesProps {
  // Icono de la página activa: emoji (texto) o URL de imagen (icono de Notion).
  icon?: string;
}

const COUNT = 10;

// Capa de fondo con iconos flotantes (estilo UpZ), sobre el fondo plano.
// Muestra el icono de la página actual repetido, subiendo lentamente con
// distintos tamaños y desenfoques. Sin degradado: el fondo queda plano.
export const BackgroundParticles: React.FC<BackgroundParticlesProps> = ({ icon }) => {
  if (!icon) return null;
  const isEmoji = !icon.startsWith('http');

  return (
    <div className="bg-particles" aria-hidden="true">
      <div className="squares">
        {Array.from({ length: COUNT }).map((_, i) => (
          <div key={i} className="square icon-particle">
            {isEmoji ? (
              <span className="emoji">{icon}</span>
            ) : (
              <img src={icon} alt="" loading="lazy" draggable={false} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
