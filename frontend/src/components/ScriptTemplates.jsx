import { useState } from 'react';
import { X, FileText, Check } from 'lucide-react';

const TEMPLATE_SCRIPTS = [
  {
    id: 'history',
    category: 'History/Documentary',
    title: 'Ancient Rome Documentary Style',
    content: `The year was 44 BC. Julius Caesar, the most powerful man in Rome, walked into the Senate. He had no idea what was about to happen.

The senators surrounded him. They carried daggers hidden in their togas. These men were his friends, his allies, his trusted colleagues.

But today, they had come to kill him.

Caesar fought back. He struggled against his attackers. But there were too many of them. Twenty-three stab wounds later, Rome's greatest leader lay dead on the Senate floor.

The assassins thought they were saving the Republic. Instead, they destroyed it. Caesar's death plunged Rome into civil war. And from that chaos, an empire was born.

Sometimes, the moments that change history happen in seconds. This was one of them.`
  },
  {
    id: 'storytelling',
    category: 'Storytelling/Narrative',
    title: 'True Crime Narrative Style',
    content: `She checked her phone one last time. 11:47 PM. The parking lot was empty. Dark. Silent.

Sarah had done this walk a hundred times before. From her car to her apartment. Thirty seconds. Nothing to worry about.

But tonight was different.

The footsteps behind her started slow. Then faster. She picked up her pace. Her keys were already in her hand, pointed outward, like her mother taught her.

When she turned around, there was no one there. Just shadows and the hum of distant traffic.

But Sarah knew something was wrong. That feeling in your gut that screams "run." We all have it. Most of us just forget to listen.

She listened. And that decision saved her life.`
  },
  {
    id: 'educational',
    category: 'Educational/Tutorial',
    title: 'Science Explainer Style',
    content: `Your brain is lying to you right now. And you don't even know it.

Here's a simple test. Look at your hand. You think you're seeing it in real time, right? Wrong.

Everything you see happened about 80 milliseconds ago. Your brain needs time to process the light, send the signals, and create the image. You're living in the past.

But it gets weirder. Your brain fills in the gaps. Those blind spots in your vision? Your brain just makes up what should be there. It's like Photoshop, but automatic.

This is called perceptual prediction. Your brain predicts what you're about to see before you actually see it. It's been doing this your entire life.

So next time you think you're experiencing reality as it happens? Remember, you're just watching a very convincing replay.`
  },
  {
    id: 'mysterious',
    category: 'Mystery/Thriller',
    title: 'Mysterious Discovery Style',
    content: `In 1947, a shepherd found seven jars in a cave near the Dead Sea. Inside? Ancient scrolls that should have crumbled to dust centuries ago.

But they didn't.

These weren't ordinary documents. The Dead Sea Scrolls contained biblical texts older than anything we'd ever found. Some dated back to 200 BC.

Here's what makes them terrifying. Many passages are different from the modern versions. Changed. Edited. Rewritten.

Who changed them? Why? And what else was altered?

The scrolls revealed one more thing. Hidden messages. Codes. Instructions. Written in a language that took decades to decrypt.

Some researchers say we've only scratched the surface. That there are still secrets buried in those ancient words. Secrets someone didn't want us to find.

The shepherd who found them died before revealing the location of the eighth jar. The one he told his family about but never brought back.

It's still out there. Somewhere in those caves. Waiting.`
  }
];

const ScriptTemplates = ({ onClose, onSelect }) => {
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template.id);
    onSelect({
      title: template.title,
      content: template.content
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Script Templates</h2>
            <p className="text-sm text-gray-600 mt-1">
              Choose a template that matches your content style
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-700">
              <strong>How to use:</strong> Select a template below to add it as a reference script. 
              Claude will analyze the style, tone, and structure to match it in your new content.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {TEMPLATE_SCRIPTS.map((template) => (
              <div
                key={template.id}
                className={`border-2 rounded-lg p-5 transition cursor-pointer ${
                  selectedTemplate === template.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="text-blue-600" size={20} />
                      <h3 className="text-lg font-semibold text-gray-800">
                        {template.title}
                      </h3>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{template.category}</p>
                  </div>
                  <button
                    onClick={() => handleSelectTemplate(template)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                      selectedTemplate === template.id
                        ? 'bg-green-600 text-white'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {selectedTemplate === template.id ? (
                      <>
                        <Check size={16} />
                        Added
                      </>
                    ) : (
                      'Use Template'
                    )}
                  </button>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                    {template.content.split('\n').slice(0, 8).join('\n')}
                    {template.content.split('\n').length > 8 && (
                      <span className="text-gray-400">...</span>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex gap-4 text-xs text-gray-500">
                  <span>{template.content.split(/\s+/).length} words</span>
                  <span>{template.content.split('\n\n').length} paragraphs</span>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-800 mb-2">Style Analysis:</h4>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• <strong>History/Documentary:</strong> Dramatic historical narratives with vivid scene-setting</li>
              <li>• <strong>Storytelling/Narrative:</strong> Suspenseful, present-tense storytelling with emotional hooks</li>
              <li>• <strong>Educational/Tutorial:</strong> Engaging explanations with mind-bending facts and clear examples</li>
              <li>• <strong>Mystery/Thriller:</strong> Dark, mysterious tone with revelations and unanswered questions</li>
            </ul>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScriptTemplates;

