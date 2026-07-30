# PROMPTS

File di lavoro personale per conservare i prompt da inviare.

**Claude: ignora questo file.** Non leggerlo, non modificarlo, non usarlo come fonte.

---

la procedura di extrude (purge) oltre a amount e speed deve avere un terzo selettore Temperature
- PETG 200C°, 220C°, 220C°, 220C° + Rotation volume 450
- PLA 200C°, 200C°, 200C°, 200C° + Rotation volume 330
- Custom (con un popup di input) + Rotation volume 330
NOTA: rotation volume nascosto visualizzare solo nome tasto, il valore di default PLA  
PS: ho i valori per l'extrude: 
Amount
- Low  = 1.000 mm3 
- Mid  = 10.000 mm3
- Hight = 20.000 mm3
Speed 
- Slow = 50mm3/s
- Standard = 150mm3/2
- Boost = 250mm3/2
ricordati sempre di aggioranre il contenuto di docs


Quando premo extrude deve eseguire/mostrare le seguenti operazioni
- Popup di avvertimento homing (stesso creato in precedenza) 
- Fa homing
- Si muove estrusole in posizione estrusero (centro x, y0 e 250)
- Si scalda estrusore (e aspetta ovviamente)
- Si estrude quanto selezionato
per ogni fase dovrebbe mostrare a schermo cosa sta facendo, per ora ho immaginato sul tasto extrude come testo del pulsante che in esecuzione sarà in stato disabled

adesso voglio implementare il wizard di avvio stampa con diverse fasi procedi/cancel, questo verrà mostrato alla pressione del tasto "Print" nei dettagli del file da stampare, avrà alcuni step:
1. Verificare che il materiale, tipo materiale, asciutto e quantità necessaria e che i tubi siano vuoti
2. Verificare che l’ugello sia pulito e che il bed sia libero
3. Applicare lo spray per proteggere il vetro (Dimafix, ma non nominare il brand)
4. Verificare che l’aspiratore sia acceso e collegato, che la ghigliottina (valvola materiale) del dryer sia aperta
Finito il wizard avvia la stampa e porta sulla dashboard 

