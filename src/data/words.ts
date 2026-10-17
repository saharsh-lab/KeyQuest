import type { Language } from '@/engine/types'

const split = (s: string) => s.trim().split(/\s+/)

/** ~300 most frequent English words, roughly in frequency order. */
export const ENGLISH_COMMON = split(`
the be of and a to in he have it that for they with as not on she at by this we you do but from or which one
would all will there say who make when can more if no man out other so what time up go about than into could
state only new year some take come these know see use get like then first any work now may such give over think
most even find day also after way many must look before great back through long where much should well people down
own just because good each those feel seem how high too place little world very still nation hand old life tell
write become here show house both between need mean call develop under last right move thing general school never
same another begin while number part turn real leave might want point form off child few small since against ask
late home interest large person end open public follow during present without again hold govern around possible
head consider word program problem however lead system set order eye plan run keep face fact group play stand
increase early course change help line city put close case force meet once water upon war build hear light unite
live every country bring center let side try provide continue name certain power pay result question study woman
member until far night always service away report something company week church toward start social room figure
nature though young less enough almost read include president nothing yet better big boy cost business value
second why clear expect family complete act sense mind experience art next near direct car law industry important
girl god several matter usual rather per often kind among white reason action return foot care simple within love
human along appear doctor believe speak active student month drive concern best door hope example inform body ever
least probable understand reach effect different idea whole control condition field pass fall note special talk
particular today measure walk teach low hour type carry rate remain full street easy although record sit determine
level local sure receive thus moment spirit train college religion perhaps music grow free cause serve age book
board recent sound office cut step class true history position above strong friend necessary add court deal tax
support party whether either land material happen education death agree arm mother across quite anything town past
view society manage answer break organize half fire lose money stop actual already effort wait department able
political learn voice air together shall cover common subject draw short wife treat limit road letter color behind
`)

/** Longer and less frequent words used for Hard and Expert difficulty. */
export const ENGLISH_ADVANCED = split(`
abstraction acquisition ambiguous apparatus approximately architecture arithmetic asymmetric authentication
bewildering bureaucracy calibration catastrophe characteristic circumference collaborate commemorate comprehensive
conscientious consequently contemporary controversial correspondence counterintuitive crystallize deliberately
demonstrate dichotomy discrepancy disproportionate effervescent embarrassment encyclopedia enthusiastically entrepreneur
equilibrium exaggerate exhilarating extraordinary facilitate fluorescent hierarchy hypothesis idiosyncrasy
illuminate immediately incandescent indispensable infrastructure intellectual interrogate irreplaceable juxtapose
kaleidoscope labyrinth liaison magnificent maintenance mediterranean meticulous miscellaneous mischievous
mnemonic necessarily negotiation neighbourhood nevertheless noticeable occasionally occurrence onomatopoeia
opportunity paradigm parallelogram perseverance phenomenon philosophical photosynthesis playwright possession
precipitation predecessor prejudice privilege pronunciation psychology questionnaire quintessential recommend
reconnaissance rehabilitation rendezvous reminiscent resilience rhythm sabotage schedule silhouette simultaneous
sophisticated spontaneous strengths subtlety surveillance synchronize temperament threshold tranquility
transcendent ubiquitous unanimous unnecessary vacuum vengeance vigilant whimsical xylophone zealous
`)

export const PROGRAMMING_WORDS = split(`
function variable const let return if else while for loop array object string number boolean null undefined class
interface type import export default async await promise callback closure scope hoisting prototype inheritance
module package dependency compile runtime syntax parser lexer token expression statement declaration parameter
argument recursion iteration index pointer reference stack queue heap tree graph node edge hash map set list
tuple vector matrix integer float double char byte bit buffer stream socket thread process mutex lock semaphore
deadlock race condition debug breakpoint exception error throw catch finally try assert test mock stub fixture
refactor commit branch merge rebase checkout clone push pull fetch diff patch release version tag build deploy
lint format compiler interpreter bytecode garbage collector memory allocation leak cache query schema migration
endpoint request response header payload json yaml regex enum generic template lambda iterator generator yield
static private public protected abstract override virtual final readonly mutable immutable getter setter method
`)

export const PROGRAMMING_IDENTIFIERS = split(`
getUserById setTimeout addEventListener useEffect fetchData isValid parseInt toString handleSubmit maxRetries
user_id created_at is_active total_count __init__ self.value this.state props.children config.json package.json
README.md index.ts main.py App.java items.map() list.append() Array.from() Object.keys() console.log()
str.split(',') arr[i] x => x * 2 i++ i += 1 a !== b a === b x >= 0 n <= 10 !isEmpty && ready ok || fallback
{ key: value } [1, 2, 3] (a, b) => a + b #include <stdio.h> std::vector<int> fn main() -> Result<()> SELECT * FROM
`)

export const TECHNOLOGY_WORDS = split(`
computer network internet server cloud database software hardware processor memory storage keyboard monitor
laptop smartphone tablet browser website application platform algorithm encryption security firewall router
bandwidth latency protocol wireless bluetooth satellite sensor robot automation artificial intelligence machine
learning neural model training dataset analytics dashboard interface design pixel display resolution graphics
camera battery charger circuit transistor semiconductor silicon chip quantum blockchain cryptocurrency startup
digital virtual reality augmented hologram drone electric vehicle autonomous navigation streaming podcast video
audio download upload backup restore update install configure operating system kernel driver firmware terminal
command shell script developer engineer product launch innovation research prototype benchmark performance speed
scalable reliable distributed cluster container orchestration microservice gateway proxy domain certificate
password biometric fingerprint recognition privacy data center fiber optic broadband gigabit megabyte terabyte
`)

export interface Quote {
  text: string
  source: string
}

export const QUOTES: Quote[] = [
  { text: 'The only way to do great work is to love what you do.', source: 'Steve Jobs' },
  { text: 'Simplicity is prerequisite for reliability.', source: 'Edsger W. Dijkstra' },
  { text: 'Programs must be written for people to read, and only incidentally for machines to execute.', source: 'Harold Abelson' },
  { text: 'It is not that I am so smart, it is just that I stay with problems longer.', source: 'Albert Einstein' },
  { text: 'The best way to predict the future is to invent it.', source: 'Alan Kay' },
  { text: 'Well done is better than well said.', source: 'Benjamin Franklin' },
  { text: 'In the middle of difficulty lies opportunity.', source: 'Albert Einstein' },
  { text: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.', source: 'Will Durant' },
  { text: 'First, solve the problem. Then, write the code.', source: 'John Johnson' },
  { text: 'Any fool can write code that a computer can understand. Good programmers write code that humans can understand.', source: 'Martin Fowler' },
  { text: 'The secret of getting ahead is getting started.', source: 'Mark Twain' },
  { text: 'Talk is cheap. Show me the code.', source: 'Linus Torvalds' },
  { text: 'Not all those who wander are lost.', source: 'J. R. R. Tolkien' },
  { text: 'It always seems impossible until it is done.', source: 'Nelson Mandela' },
  { text: 'The future depends on what you do today.', source: 'Mahatma Gandhi' },
  { text: 'Quality is not an act, it is a habit.', source: 'Aristotle' },
  { text: 'An investment in knowledge pays the best interest.', source: 'Benjamin Franklin' },
  { text: 'Make it work, make it right, make it fast.', source: 'Kent Beck' },
  { text: 'Imagination is more important than knowledge. Knowledge is limited; imagination encircles the world.', source: 'Albert Einstein' },
  { text: 'Life is what happens when you are busy making other plans.', source: 'John Lennon' },
  { text: 'You miss one hundred percent of the shots you do not take.', source: 'Wayne Gretzky' },
  { text: 'Whether you think you can, or you think you cannot, you are right.', source: 'Henry Ford' },
  { text: 'Do not watch the clock; do what it does. Keep going.', source: 'Sam Levenson' },
  { text: 'The man who moves a mountain begins by carrying away small stones.', source: 'Confucius' },
  { text: 'Debugging is twice as hard as writing the code in the first place.', source: 'Brian Kernighan' },
  { text: 'Premature optimization is the root of all evil.', source: 'Donald Knuth' },
  { text: 'Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away.', source: 'Antoine de Saint-Exupéry' },
  { text: 'A journey of a thousand miles begins with a single step.', source: 'Lao Tzu' },
  { text: 'Stay hungry, stay foolish.', source: 'Stewart Brand' },
  { text: 'The computer was born to solve problems that did not exist before.', source: 'Bill Gates' },
  { text: 'Science is organized knowledge. Wisdom is organized life.', source: 'Immanuel Kant' },
  { text: 'Energy and persistence conquer all things.', source: 'Benjamin Franklin' },
  { text: 'Act as if what you do makes a difference. It does.', source: 'William James' },
  { text: 'Fall seven times and stand up eight.', source: 'Japanese proverb' },
  { text: 'Knowing is not enough; we must apply. Willing is not enough; we must do.', source: 'Johann Wolfgang von Goethe' },
  { text: 'The expert in anything was once a beginner.', source: 'Helen Hayes' },
  { text: 'Practice does not make perfect. Only perfect practice makes perfect.', source: 'Vince Lombardi' },
  { text: 'Slow is smooth, and smooth is fast.', source: 'Military proverb' },
]

export const LANGUAGE_WORDS: Record<Exclude<Language, 'english'>, string[]> = {
  spanish: split(`
de la que el en y a los se del las un por con no una su para es al lo como más pero sus le ya o fue este ha sí
porque esta son entre cuando muy sin sobre ser tiene también me hasta hay donde han quien están estado desde todo
nos durante todos uno les ni contra otros fueron ese eso había ante ellos e esto mí antes algunos qué unos yo otro
otras otra él tanto esa estos mucho quienes nada muchos cual sea poco ella estar haber estas algunas algo nosotros
mi mis tú te ti tu tus ellas nosotras vosotros os mío mía tuyo tuya suyo nuestro casa tiempo vida día mundo año
agua hombre mujer ciudad trabajo noche país palabra mano camino historia escuela libro amigo familia
`),
  french: split(`
le de un être et à il avoir ne je son que se qui ce dans en du elle au pour pas par sur faire plus dire me on mon
lui nous comme mais pouvoir avec tout y aller voir en bien où sans tu ou leur homme si deux mari moi vouloir te
femme venir quand grand celui notre devoir là jour prendre même votre tout rien petit encore aussi quelque dont
tout mer trouver donner temps ça peu même falloir sous parler alors main chose ton mettre vie savoir yeux passer
autre après regarder toujours puis jamais cela aimer non heure croire cent monde donc enfant fois seul autour
maison école livre ami famille ville travail nuit pays mot chemin histoire eau soleil
`),
  german: split(`
der die und in den von zu das mit sich des auf für ist im dem nicht ein eine als auch es an werden aus er hat dass
sie nach wird bei einer um am sind noch wie einem über einen so zum war haben nur oder aber vor zur bis mehr durch
man sein wurde sei hatte kann gegen vom können schon wenn habe seine ihre dann unter wir soll ich eines jahr zwei
jahren diese dieser wieder keine seiner worden will zwischen immer was sagte gibt alle diesem seit muss wurden
beim doch jedoch sowie neue drei mann frau kind haus stadt welt zeit leben tag nacht arbeit land wort weg buch
freund familie schule wasser sonne geschichte
`),
}

export const LANGUAGE_LABELS: Record<Language, string> = {
  english: 'English',
  spanish: 'Español',
  french: 'Français',
  german: 'Deutsch',
}
