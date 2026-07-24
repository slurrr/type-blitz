import { Passage } from '../types.js';

export const LITERARY_PASSAGES: Passage[] = [
  {
    id: 'moby-dick',
    title: 'Moby-Dick',
    author: 'Herman Melville',
    year: 1851,
    genre: 'Adventure / Classic',
    text: 'Call me Ishmael. Some years ago—never mind how long precisely—having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world.'
  },
  {
    id: 'pride-prejudice',
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    year: 1813,
    genre: 'Romance / Classic',
    text: 'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife. However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families.'
  },
  {
    id: '1984',
    title: '1984',
    author: 'George Orwell',
    year: 1949,
    genre: 'Dystopian',
    text: 'It was a bright cold day in April, and the clocks were striking thirteen. Winston Smith, his chin nuzzled into his breast in an effort to escape the vile wind, slipped quickly through the glass doors of Victory Mansions, though not quickly enough to prevent a swirl of gritty dust from entering along with him.'
  },
  {
    id: 'great-gatsby',
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    year: 1925,
    genre: 'Modernist',
    text: 'In my younger and more vulnerable years my father gave me some advice that I have been turning over in my mind ever since. Whenever you feel like criticizing any one, he told me, just remember that all the people in this world haven\'t had the advantages that you\'ve had.'
  },
  {
    id: 'alice-wonderland',
    title: 'Alice\'s Adventures in Wonderland',
    author: 'Lewis Carroll',
    year: 1865,
    genre: 'Fantasy / Children',
    text: 'Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, and what is the use of a book, thought Alice without pictures or conversations?'
  },
  {
    id: 'frankenstein',
    title: 'Frankenstein',
    author: 'Mary Shelley',
    year: 1818,
    genre: 'Gothic Horror',
    text: 'I contemplated the lake: the waters were placid; the sky was serene; and the snowy mountains, the summits of which shone in the sunlight, formed a scene of wonderful beauty. My heart was lightened by the beauty of the scene, though my mind was tormented by memory.'
  },
  {
    id: 'metamorphosis',
    title: 'The Metamorphosis',
    author: 'Franz Kafka',
    year: 1915,
    genre: 'Absurdist Fiction',
    text: 'One morning, when Gregor Samsa woke from troubled dreams, he found himself transformed in his bed into a horrible vermin. He lay on his armour-like back, and if he lifted his head a little he could see his brown belly, slightly domed and divided by arches into stiff sections.'
  },
  {
    id: 'dracula',
    title: 'Dracula',
    author: 'Bram Stoker',
    year: 1897,
    genre: 'Gothic Horror',
    text: '3 May. Bistritz. Left Munich at 8:35 P. M., on 1st May, arriving at Vienna early next morning; should have arrived at 6:46, but train was an hour late. Buda-Pesth seems a wonderful place, from the glimpse which I got of it from the train and the little walk I had through the streets.'
  },
  {
    id: 'tale-of-two-cities',
    title: 'A Tale of Two Cities',
    author: 'Charles Dickens',
    year: 1859,
    genre: 'Historical Fiction',
    text: 'It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity, it was the season of Light, it was the season of Darkness, it was the spring of hope, it was the winter of despair.'
  },
  {
    id: 'dorian-gray',
    title: 'The Picture of Dorian Gray',
    author: 'Oscar Wilde',
    year: 1890,
    genre: 'Philosophical Fiction',
    text: 'The studio was filled with the rich odour of roses, and when the light summer wind stirred amidst the trees of the garden, there came through the open door the heavy scent of the lilac, or the more delicate perfume of the pink-flowering thorn.'
  },
  {
    id: 'sherlock-holmes',
    title: 'The Hound of the Baskervilles',
    author: 'Arthur Conan Doyle',
    year: 1902,
    genre: 'Mystery',
    text: 'Mr. Sherlock Holmes, who was usually very late in the mornings, save upon those not infrequent occasions when he was up all night, was seated at the breakfast table. I stood upon the hearth-rug and picked up the stick which our visitor had left behind him the night before.'
  },
  {
    id: 'dune',
    title: 'Dune',
    author: 'Frank Herbert',
    year: 1965,
    genre: 'Science Fiction',
    text: 'A beginning is the time for taking the most delicate care that the balances are correct. This is every sister of the Bene Gesserit knows. To begin your study of the life of Muad\'Dib, then, take care that you first place him in his time: born in the 57th year of the Padishah Emperor, Shaddam IV.'
  },
  {
    id: 'fahrenheit-451',
    title: 'Fahrenheit 451',
    author: 'Ray Bradbury',
    year: 1953,
    genre: 'Dystopian Sci-Fi',
    text: 'It was a pleasure to burn. It was a special pleasure to see things eaten, to see things blackened and changed. With the brass nozzle in his fists, with this great python spitting its venomous kerosene upon the world, the blood pounded in his head, and his hands were the hands of some amazing conductor.'
  }
];

export function getRandomPassage(): Passage {
  const index = Math.floor(Math.random() * LITERARY_PASSAGES.length);
  return LITERARY_PASSAGES[index];
}

export function getPassageById(id: string): Passage | undefined {
  return LITERARY_PASSAGES.find(p => p.id === id);
}
