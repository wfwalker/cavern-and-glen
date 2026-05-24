{$R-}    {Range checking off}
{$B+}    {Boolean complete evaluation on}
{$S+}    {Stack checking on}
{$I-}    {I/O checking off}
{$N-}    {No numeric coprocessor}
{$M 65500,16384,655360} {Turbo 3 default stack and heap}

program cavern;
{      C A V E R N   A N D   G L E N
            Written by Wm Walker
       Designed by John and Wm Walker

 although this code was essentially complete by February 1985,
 I have updated the plotting routines for a dramatic improvement.

            10/5/85 version 1.64
            1/10/88 version 1.65 <- turbo 4.0 }

uses Crt;

const VER = '1.65';  {which version is this}
         MaxSect = 41;   {# of sectors in each direction for quadrant}
         TIME_OUT = 't'; {the special time out character from B_READLN}

        {each sector is allowed to contain one thing}
   type flavor = (free, tree, monster, castle, chest, me);

        Mon = record {what we know about each kind of monster}
                      Name: string[15];
                      points, worth: real;
                      invisible: boolean;
                   end;

        Sect = record  {each sector can be one of several things}
                  case kind: flavor of
                     monster: (m: Mon);
                     castle: (me_inside: boolean);
                     chest: (id, gold: integer);
                     tree: (pic: string[3]);
                     free: (trap: boolean);
                     me: (trapped: boolean);
               end;

        Quad = array[1..MaxSect, 1..MaxSect] of Sect; {one quadrant}

        T_kind = (sword, armour, other); {kinds of treasure}

        Treasure = record  {what we know about each kind of treasure}
                      Name: string[15];
                      I_have_one, Using_it: boolean;
                      charges: integer;
                      case kind: T_kind of
                         sword: (strength: integer);
                         armour: (points: integer);
                         other: (power: integer);
                   end;

        Scr_text = string[80]; {the string for a question or statement}

   var Q: Quad; {the current quadrant}
       T_list: array[1..100] of Treasure; {list of possible treasures}
       M_list: array[1..100] of Mon; {list of possible monsters}
       x,y: array[1..100] of integer; {funny monster location list}
       Num_Monster, MaxMonster, MaxTreasure: integer;

       gold, which_swd, arrows, sx, sy: integer;  {player info}
       name: string[20]; {the player's pseudonym}
       exp: real; {the player's points -- MAXINT is too small for this var}
       quit: boolean; {do I want to end this mission}
       Mis_done: boolean;  {is the mission completed}
       Mis_target: integer;  {mission statistics}
       Mis_quota: integer;   {target=0 stands for trees}

       leave_program: boolean; {do I wanna quit or what?}
       c: char; {a work variable used by the main menu}


       { the routines are currently in two modules:
           *input/output module -- handles disk, screen, keyboard
           *gameboard module -- handles gameboard, missions, etc.}

{******* The input / output routines *********
    C_WINDOW, O_WINDOW - go to the various windows
    INSIDE - test if a certain sector is in the quadrant
    B_READLN - buffered readln complete with time out
    Y_QUESTION - ask a yes/no question
    D_QUESTION - ask a direction question
    IN_DATA - read in monster & treasure data
    LOAD_CHAR - load a character
    SAVE_CHAR - save the character
    PLOT_QUAD - plot current quadrant
    MESSAGE - plot a message on the screen
    CONTINUE - display a message, then do press enter to continue}

procedure O_window;     {invoke the output window}
begin
   Window(2,1,80,19); gotoXY(1,1);
end;

procedure C_window;    {invoke the command window}
begin
   Window(2,20,80,25); gotoXY(1,6); DelLine;
end;

procedure b_readln(var a: char);   {read complete with time out}
   const TIM = 10000;  {how long do we wait before timing out}
   var i: integer; {work variable}
begin
   i := 0; while (not KeyPressed) and (i<TIM) do i := i + 1;
   if i<>TIM then
      a := ReadKey
   else
      a := TIME_OUT;
end;


procedure Message(t: Scr_text; inv:boolean);
{send a message to command window}
begin
   C_Window;
   if inv then begin
      TextColor(15);
      writeln(t);
      TextColor(7);
   end else
      writeln(t);
end;



procedure Continue(Mess: Scr_text); {deliver the continue message}
   var z: char; {work variable}
begin
   C_Window;
   TextColor(15);
   write(Mess + 'Press ENTER <ÄÙ to continue');
   TextColor(7);
   z := ' '; while z <> #13 do b_readln(z); writeln;
end;


procedure Tell_Mission;
{tell the player what the current status of his mission is}
begin
   O_Window; gotoXY(1,18);
   if Mis_done then
      writeln(' * Mission completed *')
   else
      writeln(Mis_quota:2,' ',M_list[Mis_target].name);
end;

procedure Plot_T_list;
{list the treasures that I have}
   var k,i: integer; { work variables}
begin
   O_window; k := 1;     {display new treasure list}
   for i := 1 to MaxTreasure do
      if T_list[i].I_have_one then begin
         gotoXY(26,k);
         if T_list[i].Using_it then
            writeln('þ',i:2,') ',T_list[i].name,T_list[i].charges:3)
         else
            writeln(' ',i:2,') ',T_list[i].name,T_list[i].charges:3);
         k := k + 1;
      end;

   for i := k to 18 do begin
      gotoXY(27,i); write('                       ');
   end;
end;


function Y_Question(t: Scr_text): boolean;
{ask a yes/no question}
   var ans: char; {work variable}
begin
   C_Window; write(t + ' (y/n) > ');
   ans := 't'; while (ans='t') do b_readln(ans); writeln(ans);

   if ans<>'n' then
      Y_Question := true
   else
      Y_Question := false;
end;


procedure D_Question(t: Scr_text; var x,y: integer);
{ask for direction, then set dx and dy}
   var dir: char; {work variable}
begin
   C_Window; write(t + ' > ');
   b_readln(dir); writeln(dir);

   case dir of
      'q': begin x := -1; y :=  1; end;
      'w': begin x :=  0; y :=  1; end;
      'e': begin x :=  1; y :=  1; end;
      'a': begin x := -1; y :=  0; end;
      'd': begin x :=  1; y :=  0; end;
      'z': begin x := -1; y := -1; end;
      'x': begin x :=  0; y := -1; end;
      'c': begin x :=  1; y := -1; end;
      TIME_OUT: begin x := 999; y := 999; end;
     else begin
        Message(' I did not understand that.',FALSE);
        x := 999; y := 999;
     end;
   end; {case}
end; {D_question}


procedure I_Question(t: Scr_text; var a: integer);
{ask for a one digit integer}
   var c: char;
       wk,x,y: integer;
begin
   C_Window; write(t + ' > '); c := ' '; wk := 0; x := wherex; y := wherey;

   while c<>#13 do begin
      c := ' '; while not (c in ['0'..'9',#13]) do b_readln(c);
      if (c in ['0'..'9']) then
         wk := 10*wk + ord(c) - ord('0');

      gotoXY(x,y); write(wk:4);
   end;
   a := wk;
   gotoXY(x,y); writeln(wk:4);
end;


procedure In_data;
{read in the data for the monsters and treasures}

   var i,wk,wk2: integer;   {work variables}
       DataFile: text;  {the file itself}
       ch: char;

begin
   exp := 0.0;
   Assign(Datafile,'\tp\src\cavern.dat'); Reset(Datafile);

   i := 0;
   repeat
      i := i + 1;
      readln(Datafile, M_list[i].name,M_list[i].points,M_list[i].worth,wk);

      {remove gratuitous spaces from monster names}
      wk2 := pos('  ',M_list[i].name);
      if wk2 <> 0 then
         M_list[i].name := Copy(M_list[i].name,1,wk2-1);

      if wk = -1 then
         M_list[i].invisible := true
      else
         M_list[i].invisible := false;
   until M_list[i].name[1] = 'd';
   MaxMonster := i - 1;

   i := 0;
   repeat
      i := i + 1;
      read(Datafile, ch); read(Datafile, T_list[i].name);
      T_list[i].I_have_one := false; T_list[i].using_it := false;

      case ch of
         'a': begin
                 T_list[i].kind := armour;
                 readln(Datafile, T_list[i].points);
              end;
         's': begin
                 T_list[i].kind := sword;
                 readln(Datafile, T_list[i].strength);
              end;
         'o': begin
                 T_list[i].kind := other;
                 readln(Datafile, T_list[i].power);
              end;
         else writeln('Bad treasure in input file line ',i);
      end;
   until T_list[i].name[1] = 'd';
   MaxTreasure := i - 1;

   Close(Datafile);
end;


procedure Load_char;  {load a character from disk}

   var Char_file: text;
       nam: string[12];
       i, j, j2: integer;

begin
   C_window; write('   Type name of load file > '); readln(nam);
   Assign(Char_file, nam);
   {$I-} Reset(Char_file); {$I+}

   if IOResult = 0 then begin
      for i := 1 to MaxTreasure do begin
         T_list[i].i_have_one := false; T_list[i].using_it := false;
      end;

      which_swd := 0;

      readln(Char_file, name); readln(Char_file, exp, arrows, gold);
      readln(Char_file, j,j2);
      while j<>999 do begin
         T_list[j].i_have_one := true; T_list[j].charges := j2;
         readln(Char_file, j,j2);
      end;

      Close(Char_file);
   end else
      Continue('/'+nam+'/ does not exist. ');
end;


procedure Save_char; {save a character to disk}

   var Char_file: text;
       nam: string[12];
       i: integer;

begin
   C_window; write('   Type name of save file > '); readln(nam);
   Assign(Char_file, nam); Rewrite(Char_file);

   writeln(Char_file, name);
   writeln(Char_file, exp,' ',arrows,' ',gold);
   for i := 1 to MaxTreasure do
      if T_list[i].i_have_one then writeln(Char_file,i:5,T_list[i].charges:5);
   writeln(Char_file, 999);

   Close(Char_file);
end;


procedure Plot_Stats(inv: boolean);
{Plot the player's stats on the command window}
begin
   O_Window;
   gotoXY(1,15);

   if inv then begin
      TextBackground(15); TextColor(0);
      writeln(' Points =',exp:9:0);
      TextBackground(0); TextColor(7);
   end else
      writeln(' Points =',exp:9:0);

   writeln(' Arrows =',arrows:9); writeln(' Gold   =',gold:9);
end;


procedure Plot_Quad(tall: boolean);
{draw part of the current map}

   var i,j,k: integer;   {work variables}
       wk: string[20];

begin
   O_window;

   for i := sy+3 downto sy-3 do begin
      wk := '';
      for j := sx-3 to sx+3 do
         if (i>=1) and (i<=MaxSect) and (j>=1) and (j<=MaxSect) then
            case Q[j,i].kind of
               monster: if Q[j,i].m.invisible then
                           wk := wk + ' ú '
                        else
                           wk := wk + Q[j,i].m.name[1]+Q[j,i].m.name[2]+' ';
               tree: wk := wk + Q[j,i].pic;
               chest: wk := wk + ' '+#127+' ';
               castle: if Q[j,i].me_inside then
                          wk := wk + '®'+#1+'¯'
                       else
                          wk := wk + '® ¯';
               free: wk := wk + ' ú ';
               me: wk := wk + ' '+#2+' ';
            end {case}
         else
            wk := wk + ' + ';

      {experimental high speed plotting routine}
      if tall then
         for k := 1 to length(wk) do
            begin gotoXY(k,2*(sy+4-i)); write(wk[k]) end
      else
         for k := 1 to length(wk) do
            begin gotoXY(k,sy+4-i); write(wk[k]) end;

   end; {i loop}

   Plot_Stats(FALSE);
end; {plot_quad}


procedure Title_page; {display the title page}
begin
   window(1,1,80,25); ClrScr; {clear screen, reset window}
   TextColor(15);

   gotoXY(29,5); write('C a v e r n  &  G l e n');
   gotoXY(29,8); write('Programmed by Wm Walker');
   gotoXY(25,11); write('Designed by John and Wm Walker');
   gotoXY(9,18);
   if exp<=0.0 then
      writeln('N³ew Character    L³oad character                       Q³uit')
   else
      writeln('N³ew Character    L³oad or S³ave character   M³ission   Q³uit')
end;


{********** the gameboard routines *************
    INSIDE - test if a certain sector is in the quadrant
    MONSTER_DIED - kill of a monster. update mission stats
    MAZE - build a maze of trees in the quadrant
    SETUP_QUAD - initialize the current quadrant
    SWORD - swing with sword
    BOW - shoot with bow
    MOVE - from sector to sector. try to leave quad
    DO_CASTLE - want to leave forest?
    DO_MONSTERS - monsters move and fight
    USE_ITEM - use or unuse an item I have
    OPEN_CHEST - open a treasure chest
    COMMANDLOOP - process one command
    ONE_MISSION - perform one mission}


function Inside(a,b: integer): boolean;
{is the sector a,b legally inside the map?}
begin
   if (a>=1) and (a<=MaxSect) and (b>=1) and (b<=MaxSect) then
      Inside := true
   else
      Inside := false;
end;


procedure Monster_died(i,j: integer);
{kill off a monster at (i,j) and update mission stats}
   var scan: integer;
begin
   Message(' You killed the '+Q[i,j].m.name+'.',FALSE);
   exp := exp + Q[i,j].m.worth - Random(3)+1;
   if Q[i,j].m.name = M_list[Mis_target].name then begin
      Mis_quota := Mis_quota - 1;
      if Mis_quota = 0 then Mis_done := true;
   end;
   Q[i,j].kind := free;

   scan := 0;
   repeat
      scan := scan + 1;
   until ((x[scan]=i) and (y[scan]=j)) or (scan > Num_monster);

   if (scan<=Num_monster) then begin
      x[scan] := x[Num_monster]; y[scan] := y[Num_monster];
      Num_monster := Num_monster - 1;
   end;

   Tell_mission;
end;


procedure New_player;
{reinitialize the statistics for a new player}
   var i: integer; {work variable}
begin
   write('  What is your name? ');readln(name);
   exp := 24.0; arrows := 20; gold := 10; which_swd := 0;

   for i := 1 to MaxTreasure do begin
      T_list[i].Using_it := false; T_list[i].I_have_one := false;
      T_list[i].charges := 0;
   end;
end;


procedure maze;
{build a maze. this is supposed to go into the game
   1/4/84 Wm Walker.  I think it works now...sure is long, though}

   var Maz: array[1..20,1..20] of integer; {a compressed maze}
       Ok: array[1..4] of boolean; {ok to go in various directions}
       c,d,wk,i,j,k,count: integer;  {various work vars}
       s: string[3];

   function ins(a,b: integer): boolean;
   {is (a,b) inside the maze}
   begin
      if (a>=1) and (a<=20) and (b>=1) and (b<=20) then
         ins := true
      else
         ins := false;
   end;

   procedure doortest;
   {are the cells next to me untouched?}
      var k: integer;
   begin
      for k := 1 to 4 do Ok[k] := false;
      if ins(i,j+1) then if Maz[i,j+1]=0 then Ok[1] := true; {up}
      if ins(i,j-1) then if Maz[i,j-1]=0 then Ok[2] := true; {down}
      if ins(i+1,j) then if Maz[i+1,j]=0 then Ok[3] := true; {right}
      if ins(i-1,j) then if Maz[i-1,j]=0 then Ok[4] := true; {left}
   end;

begin
   Message('Now building the maze. Please be patient.',FALSE);

   {build the maze now.... first, initialize the whole thing}
   for i := 1 to 20 do for j := 1 to 20 do Maz[i,j] := 0;

   for i := 1 to MaxSect do
      for j := 1 to MaxSect do begin
         Q[i,j].kind := tree;
         if (i=1) or (i=MaxSect) or (j=1) or (j=MaxSect) then
            Q[i,j].pic := ' + '
         else if ((i mod 2)=0) and ((j mod 2)=1) then Q[i,j].pic := 'ÄÄÄ'
         else if ((i mod 2)=1) and ((j mod 2)=0) then Q[i,j].pic := ' ³ '
         else if ((i mod 2)=0) and ((j mod 2)=0) then Q[i,j].kind := free;
      end;

   count := 0; i := 1; j := 1;
   while count<399 do begin
      DoorTest;
      if not Ok[1] and not Ok[2] and not Ok[3] and not Ok[4] then begin
         repeat
            i := (i mod 20) + 1;
            if i = 1 then j := (j mod 20) + 1;
            DoorTest;
         until (not Ok[1] or not Ok[2] or not Ok[3] or not Ok[4]) and
            (Maz[i,j]>0);
      end else begin
         count := count + 1;
         repeat  k := Random(4)+1;  until Ok[k]=true;
         case k of
            1: begin Maz[i,j] := Maz[i,j] + 1;
                     j := j + 1; Maz[i,j] := Maz[i,j] + 2; end;
            2: begin Maz[i,j] := Maz[i,j] + 2;
                     j := j - 1; Maz[i,j] := Maz[i,j] + 1; end;
            3: begin Maz[i,j] := Maz[i,j] + 4;
                     i := i + 1; Maz[i,j] := Maz[i,j] + 8; end;
            4: begin Maz[i,j] := Maz[i,j] + 8;
                     i := i - 1; Maz[i,j] := Maz[i,j] + 4; end;
         end;{case}
      end;{if}
   end;

   for i := 1 to 20 do
      for j := 1 to 20 do begin
         if (maz[i,j] and 8) = 8 then Q[2*i-1,2*j].kind := free;
         if (maz[i,j] and 1) = 1 then Q[2*i,2*j+1].kind := free;
      end;

   {run through the maze and clean up the wall pictures}
   for c := 1 to 19 do
      for d := 1 to 19 do begin
         wk := 15;
         if Q[2*c+1,2*d+2].kind = free then wk := wk - 1;
         if Q[2*c+1,2*d].kind = free then wk := wk - 2;
         if Q[2*c+2,2*d+1].kind = free then wk := wk - 4;
         if Q[2*c,2*d+1].kind = free then wk := wk - 8;
         case wk of
            1,2,4,8: Q[2*c+1,2*d+1].kind := free;  3: s := ' ³ ';
            5: s := ' ÀÄ';    6: s := ' ÚÄ';
            7: s := ' ÃÄ';    9: s := 'ÄÙ ';
           10: s := 'Ä¿ ';   11: s := 'Ä´ ';
           12: s := 'ÄÄÄ';   13: s := 'ÄÁÄ';
           14: s := 'ÄÂÄ';   15: s := 'ÄÅÄ';
         end;
         Q[2*c+1,2*d+1].pic := s;
      end;
end; {create a maze}


procedure Setup_Quad(forest: boolean);
{ SETUP_QUAD sets up the current quadrant in Q, a global variable.
  the number of monsters is determined by Mis_quota and Mis_target.}

   var i,j,a,b,wk: integer;    {work variables}
       MaxTree,MaxChest,MaxCas: integer;

   procedure SetSect(var c,d: integer; e: flavor);
   {find a free sector. return its coordinates in c,d}
   begin
      repeat
         c := Random(MaxSect)+1; d := Random(MaxSect)+1;
      until Q[c,d].kind = free;
      Q[c,d].kind := e;
   end;

begin
   if forest then begin
      for i := 1 to MaxSect do   {zero everything first}
         for j := 1 to MaxSect do Q[i,j].kind := free;

       MaxTree := trunc((MaxSect*MaxSect)*17/100);
       for i := 1 to MaxTree do begin
          SetSect(a,b,tree); Q[a,b].pic := ' '+#5+' ';
       end;
   end else maze;

   SetSect(sx,sy,me); {plop me down in the forest}

   Num_Monster := 3*Mis_quota + 2*Random(Mis_Quota);
   for i := 1 to Num_Monster do begin
      SetSect(x[i],y[i],monster);      {set up the monsters}

      if (i<=Mis_quota) and (Mis_target>0) then
         wk := Mis_target {pick the target monster}
      else
         repeat   {pick a random monster}
            wk := Random(MaxMonster) + 1;
         until M_list[wk].points <= exp;

      Q[x[i],y[i]].m := M_list[wk];
   end;

   MaxCas := trunc((MaxSect*MaxSect)*0.4/100);
   for i := 1 to MaxCas do begin
      SetSect(a,b,castle); Q[a,b].me_inside := false; {set up the castles}
   end;

   MaxChest := Mis_Quota div 2;
   for i := 1 to MaxChest do begin
      SetSect(a,b,chest);           {set up the chest}
      if (Random(18)>6) then begin
         Q[a,b].gold := Random(50)+1; Q[a,b].id := 0;
      end else begin
         Q[a,b].id := Random(MaxTreasure)+1; Q[a,b].gold := 0;
      end;
   end;
end; {setup}


procedure Do_sword;
{ use the sword to kill monsters or cut down trees}

   var c: string[8];    {work variables}
       dx, dy, strn: integer;
       dam: real;

begin
   if which_swd = 0 then strn := 1 else strn := T_list[which_swd].strength;

   if which_swd=0 then
      D_Question(' Sword',dx,dy)
   else begin
      D_Question(' '+T_list[which_swd].name+' ',dx,dy);
      if Random(10)+1 > 9 then begin
         {randomly decided to wear down the sword by subtracting charges}
         T_list[which_swd].charges := T_list[which_swd].charges - 1;

         {determine if the sword is worn out. if so, take it away}
         if T_list[which_swd].charges <= 0 then begin
             T_list[which_swd].i_have_one := false;
             which_swd := 0;
             Plot_T_list;
          end;
       end;
   end;

   if Inside(sx+dx,sy+dy) then
      case Q[sx+dx,sy+dy].kind of
         monster: with Q[sx+dx,sy+dy] do begin
                     if exp>1.0 then
                        dam := strn*exp/(2*ln(exp))+Random(strn+3)
                     else
                        dam := 1;
                     m.points := m.points - dam;
                     if m.points <= 0 then
                        Monster_died(sx+dx,sy+dy)
                     else
                        Message('You hit the '+m.name+'.',FALSE);
                  end;
         tree: if Q[sx+dx,sy+dy].pic=' '+#5+' ' then begin
               {the maze walls are actually trees, but the player is
                not allowed to chop them down}
                  Message(' You chopped down the tree.',FALSE);
                  Q[sx+dx,sy+dy].kind := free;
               end;
         chest: Message(' You hit a treasure chest.',FALSE);
         castle: Message(' You hit a magic castle.',FALSE);
      end; {case}
end; {sword}


procedure Bow;
{fire the bow to kill monsters}

   var c: char;   {work variables}
       dx, dy, xx, yy: integer;
       dam: real;
       stop: boolean;

begin
   if arrows>0 then begin
      D_Question(' Arrow',dx,dy);
      arrows := arrows - 1; xx := sx + dx; yy := sy + dy;

      stop := false;
      while (Inside(xx,yy)) and (not stop) do begin
         case Q[xx,yy].kind of
            monster: begin
                        Message(' Arrow hit the '+Q[xx,yy].m.name,FALSE);
                        dam := 4 + int(exp / 10);
                        Q[xx,yy].m.points := Q[xx,yy].m.points - dam;
                        if Q[xx,yy].m.points<0 then Monster_died(xx,yy);
                     end;
            tree: Message(' Arrow hit a tree.',FALSE);
            castle: Message(' Arrow hit a magic castle.',FALSE);
            chest: Message(' Arrow hit a treasure chest.',FALSE);
         end; {case}

         if Q[xx,yy].kind<>free then stop := true;

         xx := xx + dx; yy := yy + dy;   {keep the arrow moving}
      end; {while loop}

      if not stop then Message(' Arrow left the forest.',FALSE);
   end else Message(' No arrows.',TRUE);
end;  {procedure bow}


procedure Move(a: char);
{player gets to move. he gets to move onto and of off castle sectors.}

   var dx,dy: integer; {work variables}

begin
   case a of
      'q': begin dx := -1; dy :=  1; end;
      'w': begin dx :=  0; dy :=  1; end;
      'e': begin dx :=  1; dy :=  1; end;
      'a': begin dx := -1; dy :=  0; end;
      'd': begin dx :=  1; dy :=  0; end;
      'z': begin dx := -1; dy := -1; end;
      'x': begin dx :=  0; dy := -1; end;
      'c': begin dx :=  1; dy := -1; end;
   end; {case}

   if Inside(sx+dx,sy+dy) then
      case Q[sx+dx,sy+dy].kind of
      {note that it it is note considered newsworthy to move into a tree}
         free: begin
                  if Q[sx,sy].kind = me then Q[sx,sy].kind := free
                  else Q[sx,sy].me_inside := false;
                  Q[sx+dx,sy+dy].kind := me;
                  sx := sx + dx; sy := sy + dy;
               end;
         castle: begin
                    Q[sx,sy].kind := free;
                    Q[sx+dx,sy+dy].me_inside := true;
                    sx := sx + dx; sy := sy + dy;
                 end;
         monster: Message(' You moved into a '+Q[sx+dx,sy+dy].m.name+'.',FALSE);
         chest: Message(' You moved into a treasure chest',FALSE);
      end; {case }
end; {procedure move}


procedure Do_castle;
{allow the player to leave this forest if he has completed his mission.
 also, allow him to buy arrows.}

   var a: integer; {work variable}

begin
   if Q[sx,sy].kind = castle then begin
      Message(' Welcome to the Magic Castle',FALSE);
      if Mis_done then begin
         if Y_Question(' Do you wish to end this mission') then quit := true;
      end else if Y_Question(' Do you want to buy some arrows') then begin
         I_Question(' How many arrows',a);
         if (a*4<=gold) then begin
            gold := gold - (a*4); arrows := arrows + a;
         end else
            Message(' Can''t do that.',FALSE);
      end; {if}
   end; {big if}
end; {do_castle}


procedure Magic(which: integer);
{This procedure contains the routines to implement
 magic spells and the powers of magic items.}

   var i,j: integer; {work variable}
       s: string[10];

begin
   case which of
      0: Message(' Nothing happens.',FALSE);
      1: begin Message(' Reveal invisibility',FALSE);
            for i := 1 to MaxSect do
               for j := 1 to MaxSect do
                  if Q[i,j].kind = monster then Q[i,j].m.invisible := false;
         end;
      2: begin Message(' Teleportation',FALSE);
            repeat
               i := Random(MaxSect)+1; j := Random(MaxSect)+1;
            until Q[i,j].kind = free;
            if Q[sx,sy].kind = me then Q[sx,sy].kind := free
            else Q[sx,sy].me_inside := false;
            Q[i,j].kind := me;
            sx := i; sy := j;
         end;
      3: begin Message(' Detect Treasure',FALSE);
            for i := 1 to MaxSect do
               for j := 1 to MaxSect do
                  if Q[i,j].kind = chest then begin
                     s:= '';
                     if sy>j then s := 'south' else if sy<j then s := 'north';
                     if sx>i then s := s + 'west' else
                     if sx<i then s := s + 'east';

                     Message(' Treasure is '+s+' of you',FALSE);
                  end;
         end;
      4: begin Message(' Detect Magic Castle',FALSE);
            for i := 1 to MaxSect do
               for j := 1 to MaxSect do
                  if Q[i,j].kind = castle then begin
                     s:= '';
                     if sy>j then s := 'south' else if sy<j then s := 'north';
                     if sx>i then s := s + 'west'
                     else if sx<i then s := s + 'east';

                     Message(' Magic Castle is '+s+' of you',FALSE);
                  end;
         end;
      else Message(' Magic power not yet implemented',FALSE);
   end; {case}
end;{magic powers procedure}


procedure Use_item;
{use or unuse the various items you have}
   var item, wk: integer; {work variable}
begin
   I_Question('Use / unuse what item',item);

   if (item>=1) and (item<=MaxTreasure) then begin
      {if it's a sword/armor, then just toggle whether he's using_it}
      if (T_list[item].kind<>other) and (T_list[item].I_have_one) then
         T_list[item].Using_it := not T_list[item].Using_it;

      {if it's a magic item, then subtract one charge and call MAGIC}
      if (T_list[item].kind=other) and (T_list[item].I_have_one) then begin
         T_list[item].charges := T_list[item].charges - 1;
         if T_list[item].charges <= 0 then T_list[item].i_have_one := false;
         Magic(T_list[item].power);
      end;

      {if it's a sword, then unuse all the other swords}
      if (T_list[item].kind = sword) then begin
         if T_list[item].using_it then
            which_swd := item
         else
            which_swd := 0;

         for wk := 1 to MaxTreasure do
            if (T_list[wk].kind = sword) and (item<>wk) then
               T_list[wk].using_it := false;
      end;

      Plot_T_list;
   end;
end; {use item}


procedure Open_chest;
{open the treasure chest, find contents, delete chest from map}

   var i,j: integer; {work variables}
       c: string[3];

begin
   for i := sx-1 to sx+1 do
      for j := sy-1 to sy+1 do
         if Inside(i,j) then
            if Q[i,j].kind = chest then begin
               if Q[i,j].gold>0 then begin
                  str(Q[i,j].gold,c);
                  Message(' You found '+c+' gold pieces',FALSE);
                  gold := gold + Q[i,j].gold;
               end else with T_list[Q[i,j].id] do begin
                  Message(' You found '+name,FALSE);
                  I_have_one := true;
                  charges := charges + Random(10) + 2;
               end;
               Q[i,j].kind := free;
            end; {if}

   Plot_T_list;
end; {open chest}


procedure Do_monsters;
{ let the monsters move and attack. They will always attack if they
  are adjacent to the player, but whether or not to move is random.
  To do this rapidly, we maintain a list of locations for the monsters
  with the x[] and y[] arrays.}

   var i,j, xx, yy: integer;  {work variables}
       dam, my_arm_points: real;
       s: string[8];

begin
   My_arm_points := 0;
   for i := 1 to MaxTreasure do
      if (T_list[i].kind = armour) and (T_list[i].Using_it) then
         My_arm_points := My_arm_points + T_list[i].points;

   for i := sx-1 to sx+1 do
      for j := sy-1 to sy+1 do
         if Inside(i,j) then
            if Q[i,j].kind = monster then
               if Q[sx,sy].kind = castle then
                  Message(' The '+Q[i,j].m.name+' misses.',FALSE)
               else begin
                  dam := Q[i,j].m.points/8 + Random(3) + Q[i,j].m.worth/4
                         - My_arm_points;
                  if dam < 0.0 then dam := 0.0;
                  exp := exp - dam;
                  Message(' The '+Q[i,j].m.name+' hits.',TRUE);
                  Plot_Stats(TRUE);
               end;

   if Q[sx,sy].kind<>castle then
      for i := 1 to Num_Monster do
      {see if each monster wants to move. If so, update both the
       quadrant Q[,] array and the x[],y[] arrays.}
         if Random(10)>3 then begin
            if x[i] > sx then xx := -1 else
             if x[i] = sx then xx := 0 else xx := 1;
            if y[i] > sy then yy := -1 else
             if y[i] = sy then yy := 0 else yy := 1;

            if Q[x[i]+xx,y[i]+yy].kind = free then begin
               Q[x[i]+xx,y[i]+yy] := Q[x[i],y[i]];
               Q[x[i],y[i]].kind := free;
               x[i] := x[i] + xx; y[i] := y[i] + yy;
            end;
         end;
end; {do_monsters}


procedure Command;
{process one keyboard command}
   var cmd: char;
begin
   C_window; write(' > '); b_readln(cmd);

   case cmd of
      'q','w','e','a','d','z','x','c': Move(cmd);
      'b': Bow;
      's': Do_sword;
      'C': Do_castle;
      'u': Use_item;
      'o': Open_chest;
      ' ',TIME_OUT: {do nothing};
      'h': begin
              Message('  q   w   e   º  b ÄÄ bow',FALSE);
              Message('    \ ³ /     º  s ÄÄ sword',FALSE);
              Message('  a ÄÄÅÄÄ d   º  o ÄÄ open chest',FALSE);
              Message('    / ³ \     º  u ÄÄ use items',FALSE);
              Message('  z   x   c   º  C ÄÄ visit Castle',FALSE);
           end;
    else Message('Press "h" for help',FALSE);
   end; {case}
end; {procedure command}


procedure One_mission;
{carry out one mission, give out rewards}

   var ereward,greward,i: integer;   {work variables}
       s, s2: string[3];
       is_forest: boolean;

begin
   {setup the mission completion variables}
   Mis_done := false; Mis_quota := round(ln(exp)) + Random(3);

   {scan through the monster list looking for an appropriate mission}
   i := 1;
   while (i<MaxMonster) and (exp>M_list[i].points) do i := i + 1;
   Mis_target := i;

   {set up the game screen}
   ClrScr; gotoXY(60,1); write('Wm Walker Software');
   gotoXY(60,2); write('VERSION '+VER);
   gotoXY(53, 5); write('MAP KEY');
   gotoXY(53, 6); write(' ',#5,'   ÄÄ Tree');    {draw map key}
   gotoXY(53, 7); write(' ú   ÄÄ Free Space');
   gotoXY(53, 8); write('® ¯  ÄÄ Castle');
   gotoXY(53, 9); write(' ',#2,'   ÄÄ Yourself');
   gotoXY(53,10); write(' +   ÄÄ Edge of forest');
   gotoXY(53,11); write('Sn   ÄÄ Monster');
   gotoXY(53,12); write(' ',#127,'   ÄÄ Treasure Chest');
   gotoXY(52,18); write('NAME: ',name);

{draw boxes on the screen}
   for i := 1 to 79 do begin
      gotoXY(i,19); write('Ä');
   end;
   for i := 1 to 18 do begin
      gotoXY( 1,i); write('³'); gotoXY(25,i); write('³');
      gotoXY(51,i); write('³');
   end;
   for i := 19 to 25 do begin
      gotoXY( 1,i); write('³');
   end;
   gotoXY( 1,19); write('Ã'); gotoXY(25,19); write('Á');
   gotoXY(51,19); write('Á');

   Tell_Mission; {plot the mission variables on the screen}

   is_forest := Y_Question('Do you want to go to the forest');
   Setup_Quad(is_forest); Plot_T_list; quit := false;

   while (exp>0) and (not quit) do begin
      Plot_Quad(is_forest);
      Command;
      Do_Monsters;
   end;
   Plot_Quad(is_forest);

   if exp<=0 then
      Continue(' *** You died, '+name+'. ')
   else
      Continue(' *** You survived, '+name+'. ');
end; {one mission}


begin {main program}
   In_data;

   leave_program := false;
   while not leave_program do begin
      Title_page;
      c := ' '; while not (c in ['n','l','s','q','m']) do b_readln(c);
      case c of
         'n': New_player;
         'l': Load_char;
         's': if exp>0 then Save_char;
         'q': leave_program := true;
         'm': if exp>0 then One_Mission;
      end;
   end;

   ClrScr;  {clear screen for the last time}
end.
