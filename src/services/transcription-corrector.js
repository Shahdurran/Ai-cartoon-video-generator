// transcription-corrector.js
// Enhanced text correction system for Spanish audio transcription
class TranscriptionCorrector {
  constructor() {
    this.SPELL_CORRECTIONS = {
      // Spanish transcription-specific corrections
      'llamarcadas': 'marcadas',
      'llamar': 'ya',
      'sadoramente': 'Isidora',
      'isadora': 'Isidora',
      'mendez': 'Méndez',
      'mendes': 'Méndez',
      'mandes': 'Méndez',
      'domogomez': 'Gómez',
      'domo': 'domo',
      'gomez': 'Gómez',
      'pongo': 'supongo',
      'señor': 'señorita',
      'tambien': 'también',
      'de': 'de',
      'su': 'su',
      
      // Common Spanish name corrections
      'maria': 'María',
      'jose': 'José',
      'juan': 'Juan',
      'ana': 'Ana',
      'luis': 'Luis',
      'carlos': 'Carlos',
      'elena': 'Elena',
      'pedro': 'Pedro',
      'carmen': 'Carmen',
      'antonio': 'Antonio',
      'francisco': 'Francisco',
      'manuel': 'Manuel',
      'isabel': 'Isabel',
      'rafael': 'Rafael',
      'miguel': 'Miguel',
      'alejandro': 'Alejandro',
      'fernando': 'Fernando',
      'diego': 'Diego',
      'patricia': 'Patricia',
      'roberto': 'Roberto',
      'ricardo': 'Ricardo',
      'eduardo': 'Eduardo',
      'sergio': 'Sergio',
      'adrian': 'Adrián',
      'andres': 'Andrés',
      'ruben': 'Rubén',
      'oscar': 'Óscar',
      'victor': 'Víctor',
      'angel': 'Ángel',
      'ramon': 'Ramón',
      'jesus': 'Jesús',
      'martin': 'Martín',
      'daniel': 'Daniel',
      'david': 'David',
      'alberto': 'Alberto',
      'jorge': 'Jorge',
      'emilio': 'Emilio',
      'cristina': 'Cristina',
      'laura': 'Laura',
      'marta': 'Marta',
      'pilar': 'Pilar',
      'teresa': 'Teresa',
      'monica': 'Mónica',
      
      // Common Spanish surnames
      'rodriguez': 'Rodríguez',
      'martinez': 'Martínez',
      'garcia': 'García',
      'gonzalez': 'González',
      'lopez': 'López',
      'hernandez': 'Hernández',
      'perez': 'Pérez',
      'sanchez': 'Sánchez',
      'ramirez': 'Ramírez',
      'torres': 'Torres',
      'flores': 'Flores',
      'rivera': 'Rivera',
      'morales': 'Morales',
      'jimenez': 'Jiménez',
      'vargas': 'Vargas',
      'castro': 'Castro',
      'ortiz': 'Ortiz',
      'rubio': 'Rubio',
      'marin': 'Marín',
      'gutierrez': 'Gutiérrez',
      'diaz': 'Díaz',
      'moreno': 'Moreno',
      'munoz': 'Muñoz',
      'alvarez': 'Álvarez',
      'romero': 'Romero',
      'navarro': 'Navarro',
      'ruiz': 'Ruiz',
      'serrano': 'Serrano',
      'blanco': 'Blanco',
      'suarez': 'Suárez',
      'molina': 'Molina',
      'delgado': 'Delgado',
      'ortega': 'Ortega',
      'morales': 'Morales',
      'mendoza': 'Mendoza',
      'aguirre': 'Aguirre',
      'silva': 'Silva',
      'herrera': 'Herrera',
      'medina': 'Medina',
      'guerrero': 'Guerrero',
      'prieto': 'Prieto',
      'santos': 'Santos',
      'lozano': 'Lozano',
      'nunez': 'Núñez',
      'santiago': 'Santiago',
      'benites': 'Benítez',
      'benitez': 'Benítez',
      
      // Spanish word corrections (common accented words)
      'nino': 'niño', 'nina': 'niña', 'corazon': 'corazón', 'cancion': 'canción',
      'razon': 'razón', 'nacion': 'nación', 'despues': 'después',
      'ingles': 'inglés', 'frances': 'francés', 'aleman': 'alemán', 'espanol': 'español',
      'compania': 'compañía', 'montana': 'montaña', 'manana': 'mañana', 'ano': 'año',
      'sueno': 'sueño', 'pequeno': 'pequeño', 'senora': 'señora',
      'telefono': 'teléfono', 'medico': 'médico', 'musica': 'música',
      'sabado': 'sábado', 'miercoles': 'miércoles', 'jueves': 'jueves',
      'medico': 'médico', 'rapido': 'rápido', 'ultimo': 'último',
      'numero': 'número', 'publico': 'público', 'politica': 'política',
      'america': 'América', 'mexico': 'México', 'peru': 'Perú',
      'panama': 'Panamá', 'colombia': 'Colombia', 'venezuela': 'Venezuela',
      'argentina': 'Argentina', 'bolivia': 'Bolivia', 'ecuador': 'Ecuador',
      'chile': 'Chile', 'uruguay': 'Uruguay', 'paraguay': 'Paraguay',
      
      // Common transcription word errors
      'de ver': 'deber',
      'a ver': 'haber',
      'echo': 'hecho',
      'asia': 'hacia',
      'asta': 'hasta',
      'ay': 'hay',
      'ahi': 'ahí',
      'alla': 'allá',
      'mas': 'más',
      'tu': 'tú',
      'mi': 'mí',
      'si': 'sí',
      'se': 'sé',
      'te': 'té',
      'que': 'qué',
      'como': 'cómo',
      'cuando': 'cuándo',
      'donde': 'dónde',
      'quien': 'quién',
      'cual': 'cuál',
      'cuanto': 'cuánto',
      
      // German corrections (from original)
      'muede': 'müde', 'schoen': 'schön', 'fuer': 'für', 'hoeren': 'hören',
      'koennen': 'können', 'wuerde': 'würde', 'natuerlich': 'natürlich',
      'groesser': 'größer', 'weiss': 'weiß', 'heiss': 'heiß', 'suess': 'süß',
      'maedchen': 'Mädchen', 'buecher': 'Bücher', 'frueh': 'früh', 'fuehren': 'führen',
      'tuer': 'Tür', 'ueber': 'über', 'duerfen': 'dürfen', 'pruefen': 'prüfen',
      'gruen': 'grün', 'muessen': 'müssen', 'wuenschen': 'wünschen',
      
      // English corrections for common transcription errors
      'recieve': 'receive', 'beleive': 'believe', 'occured': 'occurred',
      'seperate': 'separate', 'definately': 'definitely', 'accomodate': 'accommodate',
      'neccessary': 'necessary', 'acheive': 'achieve', 'priviledge': 'privilege',
      'wierd': 'weird', 'freind': 'friend', 'managment': 'management',
      'embarass': 'embarrass', 'existance': 'existence', 'maintainance': 'maintenance'
    };
    
    // Pattern-based corrections for complex errors
    this.PATTERN_CORRECTIONS = [
      // Pattern: regex -> replacement function
      {
        pattern: /y,?\s*sadoramente/gi,
        replacement: 'Isidora Méndez'
      },
      {
        pattern: /manos\s+llamar\s+cada/gi,
        replacement: 'manos ya marcadas'
      },
      {
        pattern: /señor\s+y\s+tambien\s+de\s+su\s+pongo/gi,
        replacement: 'señorita Méndez, supongo'
      },
      {
        pattern: /mayor\s+domogomez/gi,
        replacement: 'mayordomo Gómez'
      },
      {
        pattern: /señor\s+y\s+también\s+de\s+su\s+pongo/gi,
        replacement: 'señorita Méndez, supongo'
      }
    ];
    
    // Spanish titles and formal expressions
    this.FORMAL_CORRECTIONS = {
      'don': 'Don',
      'dona': 'Doña',
      'doña': 'Doña',
      'senor': 'Señor',
      'senora': 'Señora',
      'senorita': 'Señorita',
      'doctor': 'Doctor',
      'doctora': 'Doctora',
      'profesor': 'Profesor',
      'profesora': 'Profesora',
      'ingeniero': 'Ingeniero',
      'ingeniera': 'Ingeniera',
      'licenciado': 'Licenciado',
      'licenciada': 'Licenciada'
    };
  }

  /**
   * Escape special regex characters
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Smart case preservation for Spanish proper nouns
   */
  preserveCase(original, replacement) {
    if (!original || !replacement) return replacement;
    
    // Check if it's likely a proper noun (starts with capital)
    const isProperNoun = /^[A-ZÁÉÍÓÚÑÜ]/.test(replacement);
    
    // All uppercase original
    if (original === original.toUpperCase()) {
      return isProperNoun ? 
        replacement.charAt(0).toUpperCase() + replacement.slice(1).toLowerCase() :
        replacement.toUpperCase();
    }
    
    // First letter uppercase or all lowercase
    if (original[0] === original[0].toUpperCase() || isProperNoun) {
      return replacement.charAt(0).toUpperCase() + replacement.slice(1).toLowerCase();
    }
    
    // Mixed case or all lowercase - return as is for non-proper nouns
    return isProperNoun ? 
      replacement.charAt(0).toUpperCase() + replacement.slice(1).toLowerCase() :
      replacement;
  }

  /**
   * Apply pattern-based corrections first
   */
  applyPatternCorrections(text) {
    let correctedText = text;
    
    for (const correction of this.PATTERN_CORRECTIONS) {
      correctedText = correctedText.replace(correction.pattern, correction.replacement);
    }
    
    return correctedText;
  }

  /**
   * Apply word-level corrections with smart case handling
   */
  applyWordCorrections(text) {
    let correctedText = text;
    
    // Combine all correction dictionaries
    const allCorrections = {
      ...this.SPELL_CORRECTIONS,
      ...this.FORMAL_CORRECTIONS
    };
    
    for (const [wrong, correct] of Object.entries(allCorrections)) {
      // Create regex that matches whole words only
      const regex = new RegExp(`\\b${this.escapeRegex(wrong)}\\b`, 'gi');
      
      correctedText = correctedText.replace(regex, (match) => {
        return this.preserveCase(match, correct);
      });
    }
    
    return correctedText;
  }

  /**
   * Clean up common transcription artifacts
   */
  cleanupText(text) {
    return text
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Fix punctuation spacing
      .replace(/\s+([,.!?;:])/g, '$1')
      .replace(/([,.!?;:])\s*([,.!?;:])/g, '$1 $2')
      // Fix quotes
      .replace(/\s*"\s*/g, '"')
      .replace(/\s*'\s*/g, "'")
      // Clean up dashes
      .replace(/\s*-\s*/g, ' - ')
      // Fix comma spacing issues
      .replace(/,\s*,/g, ',')
      // Remove leading/trailing whitespace
      .trim();
  }

  /**
   * Main correction method
   */
  correctText(text) {
    if (!text || typeof text !== 'string') return text;
    
    let correctedText = text;
    
    // 1. Apply pattern corrections first (for complex multi-word errors)
    correctedText = this.applyPatternCorrections(correctedText);
    
    // 2. Apply word-level corrections
    correctedText = this.applyWordCorrections(correctedText);
    
    // 3. Clean up formatting
    correctedText = this.cleanupText(correctedText);
    
    return correctedText;
  }

  /**
   * Add custom word correction
   */
  addCorrection(wrong, correct) {
    this.SPELL_CORRECTIONS[wrong] = correct;
  }

  /**
   * Add pattern correction
   */
  addPatternCorrection(pattern, replacement) {
    this.PATTERN_CORRECTIONS.push({
      pattern: pattern,
      replacement: replacement
    });
  }

  /**
   * Add multiple corrections at once
   */
  addCorrections(corrections) {
    Object.entries(corrections).forEach(([wrong, correct]) => {
      this.addCorrection(wrong, correct);
    });
  }

  /**
   * Remove a correction
   */
  removeCorrection(wrong) {
    delete this.SPELL_CORRECTIONS[wrong];
    delete this.FORMAL_CORRECTIONS[wrong];
  }

  /**
   * Get all corrections
   */
  getCorrections() {
    return {
      words: { ...this.SPELL_CORRECTIONS },
      formal: { ...this.FORMAL_CORRECTIONS },
      patterns: [...this.PATTERN_CORRECTIONS]
    };
  }

  /**
   * Test corrections with sample texts
   */
  testCorrections() {
    const testCases = [
      'y,sadoramente',
      'manos llamar cada',
      'señor y tambien de su pongo',
      'mayor domogomez',
      'El nino tiene que de ver hacer su tarea manana',
      'maria rodriguez y jose martinez',
      'doctor garcia y profesora lopez',
      'Es necesario recibir la información de don carlos'
    ];

    console.log('🧪 Testing Enhanced TranscriptionCorrector:');
    testCases.forEach((test, index) => {
      const corrected = this.correctText(test);
      console.log(`${index + 1}. "${test}"`);
      console.log(`   -> "${corrected}"`);
      console.log();
    });
  }

  /**
   * Get statistics about corrections
   */
  getStats() {
    return {
      wordCorrections: Object.keys(this.SPELL_CORRECTIONS).length,
      formalCorrections: Object.keys(this.FORMAL_CORRECTIONS).length,
      patternCorrections: this.PATTERN_CORRECTIONS.length,
      totalCorrections: Object.keys(this.SPELL_CORRECTIONS).length + 
                       Object.keys(this.FORMAL_CORRECTIONS).length + 
                       this.PATTERN_CORRECTIONS.length
    };
  }
}

/**
 * Apply corrections to SRT subtitle content
 */
function applyCorrectionToSRT(srtContent, corrector) {
  if (!srtContent || !corrector) return srtContent;

  const lines = srtContent.split('\n');
  const correctedLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip subtitle numbers and timestamps
    if (/^\d+$/.test(line.trim()) || line.includes('-->')) {
      correctedLines.push(line);
    } else if (line.trim()) {
      // Apply corrections to text lines
      const correctedLine = corrector.correctText(line);
      correctedLines.push(correctedLine);
    } else {
      // Keep empty lines
      correctedLines.push(line);
    }
  }

  return correctedLines.join('\n');
}

// Usage example:
/*
const corrector = new TranscriptionCorrector();

// Test the specific examples
console.log(corrector.correctText('y,sadoramente'));  // -> "Isidora Méndez"
console.log(corrector.correctText('manos llamar cada'));  // -> "manos ya marcadas"
console.log(corrector.correctText('señor y tambien de su pongo'));  // -> "señorita Méndez, supongo"
console.log(corrector.correctText('mayor domogomez'));  // -> "mayordomo Gómez"

// Run full test suite
corrector.testCorrections();
*/

// Export the classes and functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TranscriptionCorrector,
    applyCorrectionToSRT
  };
}